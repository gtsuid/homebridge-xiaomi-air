const MiotDevice = require('./MiotDevice');

// https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:air-conditioner:0000A004:xiaomi-ra4r00:2
const MODEL = 'xiaomi.airc.ra4r00';
const FAMILY = 'air-conditioner';
const MODE = { COOL: 2, DRY: 3, FAN: 4 };
const PROPERTIES = {
    power: [2, 1, 'boolean'],
    mode: [2, 2, 'number', 2, 4],
    targetTemperature: [2, 4, 'number', 16, 31],
    fanLevel: [3, 2, 'number', 0, 7],
    fanPercent: [10, 1, 'number', 0, 101],
    horizontalSwing: [3, 3, 'boolean'],
    verticalSwing: [3, 4, 'boolean'],
    temperature: [4, 7, 'number', -50, 150],
    compressorFrequency: [12, 11, 'number', 0, 200]
};

class XiaomiAirConditionerProEco1Pk extends MiotDevice {
    constructor(platform, config) {
        const name = config.airConditionerName || 'Xiaomi Mijia Air Conditioner';
        super(platform, config, {
            name,
            family: FAMILY,
            profiles: {
                [MODEL]: {
                    family: FAMILY,
                    properties: PROPERTIES,
                    fractionalProperties: ['temperature', 'targetTemperature', 'compressorFrequency']
                }
            },
            writable: new Set(['power', 'mode', 'targetTemperature', 'fanLevel', 'fanPercent', 'horizontalSwing', 'verticalSwing']),
            readModes: Object.values(MODE),
            writeModes: [MODE.COOL]
        });
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
            .setCharacteristic(this.C.Model, MODEL)
            .setCharacteristic(this.C.SerialNumber, this.serialNumber)
            .setCharacteristic(this.C.FirmwareRevision, this.firmwareRevision);
    }

    async currentState() {
        const state = this.C.CurrentHeaterCoolerState;
        if (!await this.read('power')) return state.INACTIVE;
        if (await this.read('mode') !== MODE.COOL) return state.IDLE;
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
            const level = percent === 0 ? 0 : Math.max(1, Math.round(percent * 7 / 100));
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
            .onSet(() => this.write('mode', MODE.COOL));
        target.updateValue(C.TargetHeaterCoolerState.COOL);

        service.getCharacteristic(C.Active)
            .onGet(async () => await this.read('power') ? C.Active.ACTIVE : C.Active.INACTIVE)
            .onSet(async value => {
                const on = value === C.Active.ACTIVE;
                await this.write('power', on);
                if (on && await this.read('mode') !== MODE.COOL) {
                    await this.write('mode', MODE.COOL);
                }
            });
        service.getCharacteristic(C.CurrentHeaterCoolerState).onGet(() => this.currentState());
        service.getCharacteristic(C.CurrentTemperature)
            .setProps({ minValue: -50, maxValue: 150 })
            .onGet(() => this.read('temperature'));
        service.getCharacteristic(C.CoolingThresholdTemperature)
            .setProps({ minValue: 16, maxValue: 31, minStep: 0.5 })
            .onGet(() => this.read('targetTemperature'))
            .onSet(value => this.write('targetTemperature', Math.round(value * 2) / 2));
        service.getCharacteristic(C.RotationSpeed)
            .onGet(async () => {
                const { property, value } = await this.readFanSpeed();
                return property === 'fanLevel' ? Math.round(value * 100 / 7) : Math.min(value, 100);
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

module.exports = XiaomiAirConditionerProEco1Pk;
