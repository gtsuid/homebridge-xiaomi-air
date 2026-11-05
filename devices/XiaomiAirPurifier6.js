const Base = require('./Base');

// Protocol facts from Aulos/xiaomi-miio-air-devices, revision
// 32c4b6ba58c2c808a1c24eb86adc027b512171bf/xiaomi-airp-mc6-spec.json.
const PROPERTIES = {
    power: [2, 1, 'boolean'],
    fault: [2, 2, 'number', 0, 255],
    mode: [2, 3, 'number', 0, 6],
    anion: [2, 5, 'boolean'],
    uv: [2, 6, 'boolean'],
    humidity: [3, 1, 'number', 0, 100],
    temperature: [3, 2, 'number', -30, 100],
    airQuality: [3, 3, 'number', 0, 5],
    pm25: [3, 4, 'number', 0, 600],
    filterLife: [4, 1, 'number', 0, 100],
    screen: [6, 1, 'boolean'],
    brightness: [6, 2, 'number', 0, 2],
    buzzer: [7, 1, 'boolean'],
    childLock: [8, 1, 'boolean'],
    favoriteLevel: [9, 1, 'number', 0, 9]
};
const WRITABLE = new Set(['power', 'mode', 'anion', 'uv', 'screen', 'brightness', 'buzzer', 'childLock', 'favoriteLevel']);
const MODES = { AUTO: 0, SLEEP: 3, FAVORITE: 5 };

class XiaomiAirPurifier6 extends Base {
    constructor(platform, config) {
        super();
        this.init(platform, config);
        this.Service = platform.Service;
        this.Characteristic = platform.Characteristic;
        const accessories = [];
        const add = (key, name, services) => {
            accessories.push({
                name,
                uuid_base: `${config.ip}:${key}`,
                getServices: () => [this.information(this.serialNumber), ...services()]
            });
        };
        if (!config.airPurifierDisable) {
            add('purifier', config.airPurifierName || 'Xiaomi Air Purifier 6', () => this.purifierServices());
        }
        if (!config.temperatureDisable && config.temperatureName) {
            add('temperature', config.temperatureName, () => {
                const service = new this.Service.TemperatureSensor(config.temperatureName);
                service.getCharacteristic(this.Characteristic.CurrentTemperature)
                    .setProps({ minValue: -30, maxValue: 100 })
                    .onGet(() => this.read('temperature'));
                return [service];
            });
        }
        if (!config.humidityDisable && config.humidityName) {
            add('humidity', config.humidityName, () => {
                const service = new this.Service.HumiditySensor(config.humidityName);
                service.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).onGet(() => this.read('humidity'));
                return [service];
            });
        }
        if (!config.airQualityDisable && config.airQualityName) {
            add('airQuality', config.airQualityName, () => {
                const service = new this.Service.AirQualitySensor(config.airQualityName);
                service.getCharacteristic(this.Characteristic.AirQuality).onGet(() => this.airQuality());
                service.getCharacteristic(this.Characteristic.PM2_5Density).onGet(() => this.read('pm25'));
                return [service];
            });
        }
        for (const [key, name, disabled] of [
            ['buzzer', config.buzzerSwitchName, config.buzzerSwitchDisable],
            ['anion', config.ionizerSwitchName, config.ionizerSwitchDisable],
            ['uv', config.uvSwitchName, config.uvSwitchDisable]
        ]) {
            if (name && !disabled) add(key, name, () => [this.switchService(name, key)]);
        }
        if (!config.ledBulbDisable && config.ledBulbName) {
            add('screen', config.ledBulbName, () => {
                const service = new this.Service.Lightbulb(config.ledBulbName);
                service.getCharacteristic(this.Characteristic.On)
                    .onGet(() => this.read('screen')).onSet(value => this.write('screen', value));
                // MIoT brightness is Dim=0, Mid=2, On=1, not numerical order.
                const levels = [0, 2, 1];
                service.getCharacteristic(this.Characteristic.Brightness)
                    .setProps({ minValue: 0, maxValue: 100, minStep: 1 })
                    .onGet(async () => Math.round((levels.indexOf(await this.read('brightness')) + 1) * 100 / 3))
                    .onSet(value => this.write('brightness', levels[Math.max(0, Math.round(value * 3 / 100) - 1)]));
                return [service];
            });
        }
        return accessories;
    }

    information(serial) {
        return new this.Service.AccessoryInformation()
            .setCharacteristic(this.Characteristic.Manufacturer, 'Xiaomi')
            .setCharacteristic(this.Characteristic.Model, 'xiaomi.airp.mc6')
            .setCharacteristic(this.Characteristic.SerialNumber, serial)
            .setCharacteristic(this.Characteristic.FirmwareRevision, this.firmwareRevision);
    }

    async read(key) {
        const [siid, piid, type, min, max] = PROPERTIES[key];
        const response = await this.device.call('get_properties', [{ did: key, siid, piid }]);
        const item = Array.isArray(response) && response.find(entry => entry && entry.siid === siid && entry.piid === piid);
        if (!item || item.code !== 0 || typeof item.value !== type ||
            (type === 'number' && (!Number.isFinite(item.value) || (key !== 'temperature' && !Number.isInteger(item.value)) || item.value < min || item.value > max))) {
            throw new Error(`Air Purifier 6 property ${key} unavailable`);
        }
        return item.value;
    }

    async write(key, value) {
        const property = PROPERTIES[key];
        if (!property || !WRITABLE.has(key)) throw new Error(`Air Purifier 6 property ${key} is not writable`);
        const [siid, piid, type, min, max] = property;
        if (typeof value !== type || (type === 'number' &&
            (!Number.isInteger(value) || value < min || value > max)) ||
            (key === 'mode' && !Object.values(MODES).includes(value))) {
            throw new Error(`Invalid Air Purifier 6 value for ${key}`);
        }
        const response = await this.device.call('set_properties', [{ did: key, siid, piid, value }]);
        if (!Array.isArray(response) || response.length !== 1 || !response[0] ||
            response[0].code !== 0 || response[0].siid !== siid || response[0].piid !== piid) {
            throw new Error(`Air Purifier 6 rejected property ${key}`);
        }
    }

    async mode() {
        const mode = await this.read('mode');
        if (!Object.values(MODES).includes(mode)) throw new Error(`Unknown Air Purifier 6 mode: ${mode}`);
        return mode;
    }

    async airQuality() {
        const C = this.Characteristic.AirQuality;
        return [C.EXCELLENT, C.GOOD, C.FAIR, C.INFERIOR, C.POOR, C.POOR][await this.read('airQuality')];
    }

    switchService(name, key) {
        const service = new this.Service.Switch(name);
        service.getCharacteristic(this.Characteristic.On)
            .onGet(() => this.read(key)).onSet(value => this.write(key, value));
        return service;
    }

    purifierServices() {
        const C = this.Characteristic;
        const service = new this.Service.AirPurifier(this.config.airPurifierName || 'Xiaomi Air Purifier 6');
        const active = service.getCharacteristic(C.Active)
            .onGet(async () => await this.read('power') ? C.Active.ACTIVE : C.Active.INACTIVE)
            .onSet(async value => {
                await this.write('power', value === C.Active.ACTIVE);
                current.updateValue(value === C.Active.ACTIVE ? C.CurrentAirPurifierState.PURIFYING_AIR : C.CurrentAirPurifierState.INACTIVE);
            });
        const current = service.getCharacteristic(C.CurrentAirPurifierState)
            .onGet(async () => await this.read('power') ? C.CurrentAirPurifierState.PURIFYING_AIR : C.CurrentAirPurifierState.INACTIVE);
        const target = service.getCharacteristic(C.TargetAirPurifierState)
            .onGet(async () => await this.mode() === MODES.FAVORITE ? C.TargetAirPurifierState.MANUAL : C.TargetAirPurifierState.AUTO)
            .onSet(async value => {
                await this.write('mode', value === C.TargetAirPurifierState.AUTO ? MODES.AUTO : MODES.FAVORITE);
                if (sleep) sleep.updateValue(false);
            });
        service.getCharacteristic(C.RotationSpeed)
            .setProps({ minValue: 0, maxValue: 100, minStep: 10 })
            .onGet(async () => await this.read('power') ? (await this.read('favoriteLevel') + 1) * 10 : 0)
            .onSet(async value => {
                if (value === 0) {
                    await this.write('power', false);
                    active.updateValue(C.Active.INACTIVE);
                    current.updateValue(C.CurrentAirPurifierState.INACTIVE);
                    return;
                }
                await this.write('favoriteLevel', Math.max(0, Math.min(9, Math.round(value / 10) - 1)));
                await this.write('mode', MODES.FAVORITE);
                await this.write('power', true);
                target.updateValue(C.TargetAirPurifierState.MANUAL);
                active.updateValue(C.Active.ACTIVE);
                current.updateValue(C.CurrentAirPurifierState.PURIFYING_AIR);
                if (sleep) sleep.updateValue(false);
            });
        service.getCharacteristic(C.LockPhysicalControls)
            .onGet(async () => await this.read('childLock') ? C.LockPhysicalControls.CONTROL_LOCK_ENABLED : C.LockPhysicalControls.CONTROL_LOCK_DISABLED)
            .onSet(value => this.write('childLock', value === C.LockPhysicalControls.CONTROL_LOCK_ENABLED));
        service.getCharacteristic(C.StatusFault)
            .onGet(async () => await this.read('fault') === 0 ? C.StatusFault.NO_FAULT : C.StatusFault.GENERAL_FAULT);
        const filter = new this.Service.FilterMaintenance('Filter');
        filter.getCharacteristic(C.FilterLifeLevel).onGet(() => this.read('filterLife'));
        filter.getCharacteristic(C.FilterChangeIndication)
            .onGet(async () => await this.read('filterLife') < 5 ? C.FilterChangeIndication.CHANGE_FILTER : C.FilterChangeIndication.FILTER_OK);
        const services = [service, filter];
        let sleep;
        if (!this.config.silentModeSwitchDisable && this.config.silentModeSwitchName) {
            const switchService = new this.Service.Switch(this.config.silentModeSwitchName);
            sleep = switchService.getCharacteristic(C.On)
                .onGet(async () => await this.read('power') && await this.mode() === MODES.SLEEP)
                .onSet(async value => {
                    await this.write('mode', value ? MODES.SLEEP : MODES.AUTO);
                    if (value) {
                        await this.write('power', true);
                        active.updateValue(C.Active.ACTIVE);
                        current.updateValue(C.CurrentAirPurifierState.PURIFYING_AIR);
                    }
                    target.updateValue(C.TargetAirPurifierState.AUTO);
                });
            services.push(switchService);
        }
        return services;
    }
}

module.exports = XiaomiAirPurifier6;
