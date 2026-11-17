const MiotDevice = require('./MiotDevice');

// https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:dehumidifier:0000A02D:xiaomi-lite:1
const MODEL = 'xiaomi.derh.lite';
const MODES = { SMART: 0, SLEEP: 1, CLOTHES_DRYING: 2 };
const PROPERTIES = {
    power: [2, 1, 'boolean'], fault: [2, 2, 'number', 0, 9],
    mode: [2, 3, 'number', 0, 2], targetHumidity: [2, 5, 'number', 40, 70],
    humidity: [3, 1, 'number', 0, 100], temperature: [3, 2, 'number', -30, 100],
    buzzer: [4, 1, 'boolean'], led: [5, 1, 'boolean'],
    brightness: [5, 2, 'number', 0, 2], childLock: [6, 1, 'boolean']
};
const WRITABLE = new Set(['power', 'mode', 'targetHumidity', 'buzzer', 'led', 'brightness', 'childLock']);

const FAMILY = 'dehumidifier-lite';
const PROFILES = {
    [MODEL]: { family: FAMILY, properties: PROPERTIES, fractionalProperties: ['temperature'] }
};

class XiaomiDehumidifierLite extends MiotDevice {
    constructor(platform, config) {
        super(platform, config, {
            family: FAMILY, profiles: PROFILES, name: 'Dehumidifier', writable: WRITABLE
        });
        this.Service = platform.Service;
        this.C = platform.Characteristic;
        this.name = config.dehumidifierName || 'Xiaomi Smart Dehumidifier Lite';
        const accessories = [];
        const add = (key, name, build) => accessories.push({
            name, uuid_base: `${config.ip}:dehumidifier:${key}`,
            getServices: () => [this.information(), ...build()]
        });
        if (!config.dehumidifierDisable) add('main', this.name, () => this.dehumidifierServices());
        if (!config.temperatureDisable && config.temperatureName) {
            add('temperature', config.temperatureName, () => {
                const service = new this.Service.TemperatureSensor(config.temperatureName);
                service.getCharacteristic(this.C.CurrentTemperature).setProps({ minValue: -30, maxValue: 100 })
                    .onGet(() => this.read('temperature'));
                return [service];
            });
        }
        if (!config.humidityDisable && config.humidityName) {
            add('humidity', config.humidityName, () => {
                const service = new this.Service.HumiditySensor(config.humidityName);
                service.getCharacteristic(this.C.CurrentRelativeHumidity).onGet(() => this.read('humidity'));
                this.faultCharacteristic(service);
                return [service];
            });
        }
        if (!config.buzzerSwitchDisable && config.buzzerSwitchName) {
            add('buzzer', config.buzzerSwitchName, () => {
                const service = new this.Service.Switch(config.buzzerSwitchName);
                service.getCharacteristic(this.C.On).onGet(() => this.read('buzzer')).onSet(value => this.write('buzzer', value));
                return [service];
            });
        }
        if (!config.ledBulbDisable && config.ledBulbName) {
            add('screen', config.ledBulbName, () => [this.screenService()]);
        }
        if (!config.waterTankFullSensorDisable && config.waterTankFullSensorName) {
            add('tank', config.waterTankFullSensorName, () => {
                const service = new this.Service.ContactSensor(config.waterTankFullSensorName);
                service.getCharacteristic(this.C.ContactSensorState).onGet(async () =>
                    await this.read('fault') === 1 ? this.C.ContactSensorState.CONTACT_NOT_DETECTED : this.C.ContactSensorState.CONTACT_DETECTED);
                this.faultCharacteristic(service);
                return [service];
            });
        }
        return accessories;
    }

    information() {
        return new this.Service.AccessoryInformation()
            .setCharacteristic(this.C.Manufacturer, 'Xiaomi')
            .setCharacteristic(this.C.Model, MODEL)
            .setCharacteristic(this.C.SerialNumber, this.serialNumber)
            .setCharacteristic(this.C.FirmwareRevision, this.firmwareRevision);
    }

    faultCharacteristic(service) {
        service.getCharacteristic(this.C.StatusFault).onGet(async () =>
            await this.read('fault') === 0 ? this.C.StatusFault.NO_FAULT : this.C.StatusFault.GENERAL_FAULT);
    }

    async currentState() {
        const S = this.C.CurrentHumidifierDehumidifierState;
        if (!await this.read('power')) return S.INACTIVE;
        if (await this.read('fault') !== 0) return S.IDLE;
        // The schema has no compressor-running property. This reports inferred
        // demand, not measured compressor activity (including start-up delays).
        if (await this.read('mode') === MODES.CLOTHES_DRYING) return S.DEHUMIDIFYING;
        return await this.read('humidity') > await this.read('targetHumidity') ? S.DEHUMIDIFYING : S.IDLE;
    }

    dehumidifierServices() {
        const C = this.C;
        const service = new this.Service.HumidifierDehumidifier(this.name);
        const presets = new Map();
        const updatePresets = mode => {
            for (const [value, characteristic] of presets) characteristic.updateValue(value === mode);
        };
        const current = service.getCharacteristic(C.CurrentHumidifierDehumidifierState).onGet(() => this.currentState());
        const active = service.getCharacteristic(C.Active)
            .onGet(async () => await this.read('power') ? C.Active.ACTIVE : C.Active.INACTIVE)
            .onSet(async value => {
                const on = value === C.Active.ACTIVE;
                await this.write('power', on);
                current.updateValue(on ? C.CurrentHumidifierDehumidifierState.IDLE : C.CurrentHumidifierDehumidifierState.INACTIVE);
                if (!on) updatePresets(null);
            });
        service.getCharacteristic(C.CurrentRelativeHumidity).onGet(() => this.read('humidity'));
        service.getCharacteristic(C.TargetHumidifierDehumidifierState)
            .setProps({ validValues: [C.TargetHumidifierDehumidifierState.DEHUMIDIFIER] })
            .onGet(() => C.TargetHumidifierDehumidifierState.DEHUMIDIFIER)
            .onSet(value => {
                if (value !== C.TargetHumidifierDehumidifierState.DEHUMIDIFIER) throw new Error('Only dehumidification is supported');
            });
        service.getCharacteristic(C.RelativeHumidityDehumidifierThreshold)
            .setProps({ minValue: 40, maxValue: 70, minStep: 1 })
            .onGet(() => this.read('targetHumidity'))
            .onSet(async value => {
                await this.write('targetHumidity', value);
                await this.write('mode', MODES.SMART);
                updatePresets(MODES.SMART);
            });
        service.getCharacteristic(C.LockPhysicalControls)
            .onGet(async () => await this.read('childLock') ? C.LockPhysicalControls.CONTROL_LOCK_ENABLED : C.LockPhysicalControls.CONTROL_LOCK_DISABLED)
            .onSet(value => this.write('childLock', value === C.LockPhysicalControls.CONTROL_LOCK_ENABLED));
        const services = [service];
        for (const [mode, name, disabled] of [
            [MODES.SLEEP, this.config.silentModeSwitchName, this.config.silentModeSwitchDisable],
            [MODES.CLOTHES_DRYING, this.config.clothesDryingSwitchName, this.config.clothesDryingSwitchDisable]
        ]) {
            if (!name || disabled) continue;
            const toggle = new this.Service.Switch(name, `mode-${mode}`);
            const characteristic = toggle.getCharacteristic(C.On)
                .onGet(async () => await this.read('power') && await this.read('mode') === mode)
                .onSet(async value => {
                    if (!value && await this.read('mode') !== mode) return;
                    const next = value ? mode : MODES.SMART;
                    await this.write('mode', next);
                    if (value) await this.write('power', true);
                    updatePresets(next);
                    if (value) {
                        active.updateValue(C.Active.ACTIVE);
                        current.updateValue(C.CurrentHumidifierDehumidifierState.IDLE);
                    }
                });
            presets.set(mode, characteristic);
            services.push(toggle);
        }
        return services;
    }

    screenService() {
        const service = new this.Service.Lightbulb(this.config.ledBulbName);
        const on = service.getCharacteristic(this.C.On)
            .onGet(async () => await this.read('led') && await this.read('brightness') > 0)
            .onSet(async value => {
                if (value && await this.read('brightness') === 0) await this.write('brightness', 2);
                await this.write('led', value);
            });
        service.getCharacteristic(this.C.Brightness)
            .onGet(async () => await this.read('led') ? await this.read('brightness') * 50 : 0)
            .onSet(async value => {
                const level = value === 0 ? 0 : value <= 50 ? 1 : 2;
                await this.write('brightness', level);
                await this.write('led', level > 0);
                on.updateValue(level > 0);
            });
        return service;
    }
}

module.exports = XiaomiDehumidifierLite;
