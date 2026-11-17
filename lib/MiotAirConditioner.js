const { MiotDevice } = require('./Base');

class MiotAirConditioner extends MiotDevice {
    constructor(platform, config, { model, name: defaultName, profile, writable, modes, targetTemperatureStep }) {
        const name = config.airConditionerName || defaultName;
        super(platform, config, {
            name,
            family: profile.family,
            profiles: { [model]: profile },
            writable,
            readModes: Object.values(modes),
            writeModes: [modes.COOL]
        });
        this.model = model;
        this.modes = modes;
        this.properties = profile.properties;
        this.targetTemperatureStep = targetTemperatureStep;
        const [, , , , fanLevelMax] = this.properties.fanLevel;
        this.fanLevelMax = fanLevelMax;
        this.Service = platform.Service;
        this.C = platform.Characteristic;
        this.fanSpeedProperty = 'fanLevel';
        return [{
            name,
            uuid_base: `${config.ip}:air-conditioner`,
            getServices: () => [this.information(), this.heaterCooler(name)]
        }];
    }

    information() {
        return new this.Service.AccessoryInformation()
            .setCharacteristic(this.C.Manufacturer, 'Xiaomi')
            .setCharacteristic(this.C.Model, this.model)
            .setCharacteristic(this.C.SerialNumber, this.serialNumber)
            .setCharacteristic(this.C.FirmwareRevision, this.firmwareRevision);
    }

    async currentState() {
        const state = this.C.CurrentHeaterCoolerState;
        if (!await this.read('power')) return state.INACTIVE;
        if (await this.read('mode') !== this.modes.COOL) return state.IDLE;
        // Some firmware may expose the standard properties but omit compressor telemetry over LAN.
        const frequency = await this.read('compressorFrequency').catch(() => undefined);
        const cooling = frequency === undefined
            ? await this.read('temperature') > await this.read('targetTemperature')
            : frequency > 0;
        return cooling ? state.COOLING : state.IDLE;
    }

    async readFanSpeed() {
        const preferred = this.fanSpeedProperty;
        const value = await this.read(preferred).catch(() => undefined);
        if (value !== undefined) return { property: preferred, value };

        const property = preferred === 'fanLevel' ? 'fanPercent' : 'fanLevel';
        return { property, value: await this.read(property) };
    }

    async writeFanSpeed(percent) {
        const { property } = await this.readFanSpeed();
        if (property === 'fanLevel') {
            const level = percent === 0 ? 0 : Math.max(1, Math.round(percent * this.fanLevelMax / 100));
            try {
                await this.write('fanLevel', level);
                this.fanSpeedProperty = 'fanLevel';
                return;
            } catch (error) {
                // Retry via fan-percent only when the device explicitly rejects the property.
                if (![-4002, -4003, -4005].includes(error.miotCode)) throw error;
                await this.read('fanPercent');
            }
        }
        await this.write('fanPercent', Math.round(percent));
        this.fanSpeedProperty = 'fanPercent';
    }

    heaterCooler(name) {
        const C = this.C;
        const service = new this.Service.HeaterCooler(name);
        const target = service.getCharacteristic(C.TargetHeaterCoolerState)
            .setProps({ validValues: [C.TargetHeaterCoolerState.COOL] })
            .onGet(() => C.TargetHeaterCoolerState.COOL)
            .onSet(() => this.write('mode', this.modes.COOL));
        target.updateValue(C.TargetHeaterCoolerState.COOL);

        service.getCharacteristic(C.Active)
            .onGet(async () => await this.read('power') ? C.Active.ACTIVE : C.Active.INACTIVE)
            .onSet(async value => {
                const on = value === C.Active.ACTIVE;
                await this.write('power', on);
                if (on && await this.read('mode') !== this.modes.COOL) {
                    await this.write('mode', this.modes.COOL);
                }
            });
        service.getCharacteristic(C.CurrentHeaterCoolerState).onGet(() => this.currentState());
        const [, , , minTemperature, maxTemperature] = this.properties.temperature;
        const [, , , minTarget, maxTarget] = this.properties.targetTemperature;
        const step = this.targetTemperatureStep;
        service.getCharacteristic(C.CurrentTemperature)
            .setProps({ minValue: minTemperature, maxValue: maxTemperature })
            .onGet(() => this.read('temperature'));
        service.getCharacteristic(C.CoolingThresholdTemperature)
            .setProps({ minValue: minTarget, maxValue: maxTarget, minStep: step })
            .onGet(() => this.read('targetTemperature'))
            .onSet(value => this.write('targetTemperature', Math.round(value / step) * step));
        service.getCharacteristic(C.RotationSpeed)
            .onGet(async () => {
                const { property, value } = await this.readFanSpeed();
                return property === 'fanLevel' ? Math.round(value * 100 / this.fanLevelMax) : Math.min(value, 100);
            })
            .onSet(value => this.writeFanSpeed(value));
        service.getCharacteristic(C.SwingMode)
            .onGet(async () => await this.read('horizontalSwing') || await this.read('verticalSwing')
                ? C.SwingMode.SWING_ENABLED : C.SwingMode.SWING_DISABLED)
            .onSet(async value => {
                const enabled = value === C.SwingMode.SWING_ENABLED;
                await this.write('horizontalSwing', enabled);
                await this.write('verticalSwing', enabled);
            });
        return service;
    }
}

module.exports = MiotAirConditioner;
