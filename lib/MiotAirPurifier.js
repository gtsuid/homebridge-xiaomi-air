const { MiotDevice } = require('./Base');

const MODES = { AUTO: 0, SLEEP: 1, FAVORITE: 2, FAN: 3 };
const WRITABLE = new Set(['power', 'mode', 'favoriteLevel', 'favoriteRpm', 'buzzer', 'childLock', 'brightness', 'anion', 'uv', 'screen']);

class MiotAirPurifier extends MiotDevice {
    constructor(platform, config, definition) {
        const { family, profiles, name, features, modes = MODES } = definition;
        super(platform, config, {
            family, profiles, name, writable: WRITABLE,
            readModes: Object.values(modes),
            // Fan mode can be read, but the HomeKit Manual selector writes Favorite.
            writeModes: [modes.AUTO, modes.SLEEP, modes.FAVORITE]
        });
        this.features = features;
        this.modes = modes;
        this.name = config.airPurifierName || name;
        this.Service = platform.Service;
        this.C = platform.Characteristic;
        const accessories = [];
        const add = (key, name, build) => accessories.push({
            name, uuid_base: `${config.ip}:${key}`,
            getServices: () => [this.information(), ...build()]
        });
        if (!config.airPurifierDisable) add('purifier', this.name, () => this.purifierServices());
        if (features.environment && !config.temperatureDisable && config.temperatureName) {
            add('temperature', config.temperatureName, () => {
                const service = new this.Service.TemperatureSensor(config.temperatureName);
                service.getCharacteristic(this.C.CurrentTemperature).setProps({ minValue: features.temperatureRange?.[0] ?? -30, maxValue: features.temperatureRange?.[1] ?? 100 })
                    .onGet(() => this.read('temperature'));
                return [service];
            });
        }
        if (features.environment && !config.humidityDisable && config.humidityName) {
            add('humidity', config.humidityName, () => {
                const service = new this.Service.HumiditySensor(config.humidityName);
                service.getCharacteristic(this.C.CurrentRelativeHumidity).onGet(() => this.read('humidity'));
                return [service];
            });
        }
        if (!config.airQualityDisable && config.airQualityName) {
            add('airQuality', config.airQualityName, () => {
                const service = new this.Service.AirQualitySensor(config.airQualityName);
                service.getCharacteristic(this.C.PM2_5Density).onGet(() => this.read('pm25'));
                service.getCharacteristic(this.C.AirQuality).onGet(async () => {
                    const quality = this.C.AirQuality;
                    if (features.airQuality) {
                        return [quality.EXCELLENT, quality.GOOD, quality.FAIR, quality.INFERIOR, quality.POOR, quality.POOR][await this.read('airQuality')];
                    }
                    const pm25 = await this.read('pm25');
                    return pm25 <= 50 ? quality.EXCELLENT : pm25 <= 100 ? quality.GOOD :
                        pm25 <= 200 ? quality.FAIR : pm25 <= 300 ? quality.INFERIOR : quality.POOR;
                });
                return [service];
            });
        }
        if (!config.buzzerSwitchDisable && config.buzzerSwitchName) {
            add('buzzer', config.buzzerSwitchName, () => [this.switchService(config.buzzerSwitchName, 'buzzer')]);
        }
        if (features.ionizer && !config.ionizerSwitchDisable && config.ionizerSwitchName) {
            add('anion', config.ionizerSwitchName, () => [this.switchService(config.ionizerSwitchName, 'anion')]);
        }
        if (features.uv && !config.uvSwitchDisable && config.uvSwitchName) {
            add('uv', config.uvSwitchName, () => [this.switchService(config.uvSwitchName, 'uv')]);
        }
        if (!config.ledBulbDisable && config.ledBulbName) {
            add('screen', config.ledBulbName, () => [this.screenService()]);
        }
        return accessories;
    }

    information() {
        return new this.Service.AccessoryInformation()
            .setCharacteristic(this.C.Manufacturer, 'Xiaomi')
            .setCharacteristic(this.C.Model, this.config.model || this.displayName)
            .setCharacteristic(this.C.SerialNumber, this.serialNumber)
            .setCharacteristic(this.C.FirmwareRevision, this.firmwareRevision);
    }

    switchService(name, key) {
        const service = new this.Service.Switch(name);
        service.getCharacteristic(this.C.On).onGet(() => this.read(key)).onSet(value => this.write(key, value));
        return service;
    }

    screenService() {
        const service = new this.Service.Lightbulb(this.config.ledBulbName);
        if (this.features.screenPower) {
            // Screen power is independent of the model's Dim/Mid/Normal levels.
            const levels = this.features.brightnessLevels || [0, 1];
            service.getCharacteristic(this.C.On)
                .onGet(() => this.read('screen')).onSet(value => this.write('screen', value));
            service.getCharacteristic(this.C.Brightness)
                .onGet(async () => {
                    const index = levels.indexOf(await this.read('brightness'));
                    if (index < 0) throw new Error(`${this.displayName} brightness unavailable`);
                    return Math.round((index + 1) * 100 / levels.length);
                })
                .onSet(value => this.write('brightness', levels[levels.length === 2
                    ? (value <= 50 ? 0 : 1) : Math.max(0, Math.round(value * levels.length / 100) - 1)]));
            return service;
        }
        const levels = this.features.brightnessLevels || [0, 1, 2];
        let lastIndex = levels.length - 1;
        const read = async () => {
            const raw = await this.read('brightness');
            const index = levels.indexOf(raw);
            if (index < 0) throw new Error(`${this.displayName} brightness unavailable`);
            if (index > 0) lastIndex = index;
            return index;
        };
        const percent = index => Math.round(index * 100 / (levels.length - 1));
        const on = service.getCharacteristic(this.C.On)
            .onGet(async () => await read() > 0)
            .onSet(async value => {
                const index = value ? lastIndex : 0;
                await this.write('brightness', levels[index]);
                brightness.updateValue(percent(index));
            });
        const brightness = service.getCharacteristic(this.C.Brightness)
            .onGet(async () => percent(await read()))
            .onSet(async value => {
                // Preserve the 4-series Off/Dim/Bright thresholds.
                const index = levels.length === 3
                    ? (value === 0 ? 0 : value <= 50 ? 1 : 2)
                    : Math.round(value * (levels.length - 1) / 100);
                await this.write('brightness', levels[index]);
                if (index > 0) lastIndex = index;
                on.updateValue(index > 0);
            });
        return service;
    }

    purifierServices() {
        const C = this.C;
        const MODES = this.modes;
        const service = new this.Service.AirPurifier(this.name);
        const active = service.getCharacteristic(C.Active)
            .onGet(async () => await this.read('power') ? C.Active.ACTIVE : C.Active.INACTIVE)
            .onSet(async value => {
                await this.write('power', value === C.Active.ACTIVE);
                current.updateValue(value === C.Active.ACTIVE ? C.CurrentAirPurifierState.PURIFYING_AIR : C.CurrentAirPurifierState.INACTIVE);
            });
        const current = service.getCharacteristic(C.CurrentAirPurifierState)
            .onGet(async () => await this.read('power') ? C.CurrentAirPurifierState.PURIFYING_AIR : C.CurrentAirPurifierState.INACTIVE);
        const target = service.getCharacteristic(C.TargetAirPurifierState)
            .onGet(async () => [MODES.FAVORITE, MODES.FAN].includes(await this.read('mode')) ? C.TargetAirPurifierState.MANUAL : C.TargetAirPurifierState.AUTO)
            .onSet(async value => {
                await this.write('mode', value === C.TargetAirPurifierState.AUTO ? MODES.AUTO : MODES.FAVORITE);
                if (sleep) sleep.updateValue(false);
            });
        service.getCharacteristic(C.RotationSpeed).setProps({ minValue: 0, maxValue: 100, minStep: 1 })
            .onGet(async () => {
                if (!await this.read('power')) return 0;
                const profile = await this.getProfile();
                if (profile.speedProperty === 'favoriteRpm') {
                    const [, , , min, max] = profile.properties.favoriteRpm;
                    return Math.round(1 + (await this.read('favoriteRpm') - min) * 99 / (max - min));
                }
                const count = profile.properties.favoriteLevel[4] + 1;
                return Math.round((await this.read('favoriteLevel') + 1) * 100 / count);
            })
            .onSet(async value => {
                if (value === 0) {
                    await this.write('power', false);
                    active.updateValue(C.Active.INACTIVE);
                    current.updateValue(C.CurrentAirPurifierState.INACTIVE);
                    return;
                }
                const profile = await this.getProfile();
                if (profile.speedProperty === 'favoriteRpm') {
                    const [, , , min, max] = profile.properties.favoriteRpm;
                    await this.write('favoriteRpm', Math.round(min + (value - 1) * (max - min) / 99));
                } else {
                    const count = profile.properties.favoriteLevel[4] + 1;
                    const level = Math.max(0, Math.min(count - 1, Math.round(value * count / 100) - 1));
                    await this.write('favoriteLevel', level);
                }
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
        if (this.features.fault !== false) {
            service.getCharacteristic(C.StatusFault)
                .onGet(async () => await this.read('fault') === 0 ? C.StatusFault.NO_FAULT : C.StatusFault.GENERAL_FAULT);
        }
        const filter = new this.Service.FilterMaintenance('Filter');
        filter.getCharacteristic(C.FilterLifeLevel).onGet(() => this.read('filterLife'));
        filter.getCharacteristic(C.FilterChangeIndication)
            .onGet(async () => await this.read('filterLife') < 5 ? C.FilterChangeIndication.CHANGE_FILTER : C.FilterChangeIndication.FILTER_OK);
        const services = [service, filter];
        let sleep;
        if (!this.config.silentModeSwitchDisable && this.config.silentModeSwitchName) {
            const toggle = new this.Service.Switch(this.config.silentModeSwitchName);
            sleep = toggle.getCharacteristic(C.On)
                .onGet(async () => await this.read('power') && await this.read('mode') === MODES.SLEEP)
                .onSet(async value => {
                    await this.write('mode', value ? MODES.SLEEP : MODES.AUTO);
                    if (value) {
                        await this.write('power', true);
                        active.updateValue(C.Active.ACTIVE);
                        current.updateValue(C.CurrentAirPurifierState.PURIFYING_AIR);
                    }
                    target.updateValue(C.TargetAirPurifierState.AUTO);
                });
            services.push(toggle);
        }
        return services;
    }
}

module.exports = MiotAirPurifier;
