const Base = require('../lib/Base');

const inherits = require('util').inherits;

// Shared Series 1 accessories, with explicit protocol differences per model.
const FIXED_SPEEDS = [['low', 25], ['medium', 50], ['high', 75], ['strong', 100]];

function modeForSpeed(speed) {
    if (speed > 0 && speed <= 100) return FIXED_SPEEDS.find(([, upper]) => speed <= upper)[0];
    return 'low';
}

function speedForMode(mode, cachedSpeed) {
    const index = FIXED_SPEEDS.findIndex(([name]) => name === mode);
    if (index < 0) return 0;
    const lower = index === 0 ? 0 : FIXED_SPEEDS[index - 1][1];
    const upper = FIXED_SPEEDS[index][1];
    return cachedSpeed > lower && cachedSpeed <= upper ? cachedSpeed : upper;
}

const PROFILES = {
    original: {
        model: 'AirPurifier', label: 'XiaomiAirPurifier', environment: false, childLock: false,
        powerProperty: 'mode', offValue: 'idle',
        powerCommand: on => ['set_mode', [on ? 'auto' : 'idle']],
        manualMode: modeForSpeed,
        isAutomatic: mode => mode === 'auto' || mode === 'silent',
        speedProperty: 'mode', readSpeed: speedForMode, favorite: false,
        speedCommand: (speed, cachedSpeed) => modeForSpeed(speed) === modeForSpeed(cachedSpeed)
            ? null : ['set_mode', [modeForSpeed(speed)]],
        buzzerProperty: 'buzzer', buzzerState: value => value === 'on' ? 1 : 0,
        buzzerCommand: on => ['set_buzzer', [on ? 'on' : 'off']]
    },
    pro: {
        model: 'AirPurifierPro', label: 'XiaomiAirPurifierPro', environment: true, childLock: true,
        powerProperty: 'power', offValue: 'off',
        powerCommand: on => ['set_power', [on ? 'on' : 'off']],
        manualMode: () => 'favorite', isAutomatic: mode => mode !== 'favorite',
        speedProperty: 'favorite_level', readSpeed: level => level, favorite: true,
        speedCommand: speed => ['set_level_favorite', [parseInt(speed / 10) < 10 ? parseInt(speed / 10) + 1 : 10]],
        buzzerProperty: 'volume', buzzerState: value => value == 0 ? false : true,
        buzzerCommand: on => ['set_volume', [on ? 100 : 0]]
    }
};

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;

var XiaomiAirPurifier = function(platform, config, variant = 'original') {
    this.profile = PROFILES[variant];
    if (!this.profile) throw new Error('Unknown Series 1 purifier variant: ' + variant);
    this.init(platform, config);
    
    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;
    

    this.accessories = {};
    if(!this.config['airPurifierDisable']) {
        this.accessories['airPurifierAccessory'] = new XiaomiAirPurifierAirPurifierAccessory(this);
    }
    if(this.profile.environment && !this.config['temperatureDisable'] && this.config['temperatureName'] && this.config['temperatureName'] != "") {
        this.accessories['temperatureAccessory'] = new XiaomiAirPurifierTemperatureAccessory(this);
    }
    if(this.profile.environment && !this.config['humidityDisable'] && this.config['humidityName'] && this.config['humidityName'] != "") {
        this.accessories['humidityAccessory'] = new XiaomiAirPurifierHumidityAccessory(this);
    }
    if(!this.config['buzzerSwitchDisable'] && this.config['buzzerSwitchName'] && this.config['buzzerSwitchName'] != "") {
        this.accessories['buzzerSwitchAccessory'] = new XiaomiAirPurifierBuzzerSwitchAccessory(this);
    }
    if(!this.config['ledBulbDisable'] && this.config['ledBulbName'] && this.config['ledBulbName'] != "") {
        this.accessories['ledBulbAccessory'] = new XiaomiAirPurifierLEDBulbAccessory(this);
    }
    if(!this.config['airQualityDisable'] && this.config['airQualityName'] && this.config['airQualityName'] != "") {
        this.accessories['airQualityAccessory'] = new XiaomiAirPurifierAirQualityAccessory(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[XiaomiAirPlatform][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    return accessoriesArr;
}
inherits(XiaomiAirPurifier, Base);

var XiaomiAirPurifierAirPurifierAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.serialNumber = dThis.serialNumber;
    this.name = dThis.config['airPurifierName'] || 'Xiaomi ' + this.profile.model.replace('AirPurifier', 'Air Purifier ').trim();
    this.silentModeSwitchDisable = dThis.config['silentModeSwitchDisable'];
    this.silentModeSwitchName = dThis.config['silentModeSwitchName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifierAirPurifierAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
    services.push(infoService);

    var silentModeSwitch = new Service.Switch(this.silentModeSwitchName || 'Sleep Mode');
    var silentModeOnCharacteristic = silentModeSwitch.getCharacteristic(Characteristic.On);
    if(this.silentModeSwitchName && !this.silentModeSwitchDisable) {
        services.push(silentModeSwitch);
    }
    
    var airPurifierService = new Service.AirPurifier(this.name);
    var activeCharacteristic = airPurifierService.getCharacteristic(Characteristic.Active);
    var currentAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.CurrentAirPurifierState);
    var targetAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.TargetAirPurifierState);
    var lockPhysicalControlsCharacteristic = this.profile.childLock
        ? airPurifierService.addCharacteristic(Characteristic.LockPhysicalControls) : null;
    var rotationSpeedCharacteristic = airPurifierService.addCharacteristic(Characteristic.RotationSpeed);
    
    var currentTemperatureCharacteristic = this.profile.environment
        ? airPurifierService.addCharacteristic(Characteristic.CurrentTemperature) : null;
	var currentRelativeHumidityCharacteristic = this.profile.environment
        ? airPurifierService.addCharacteristic(Characteristic.CurrentRelativeHumidity) : null;
    var pm25DensityCharacteristic = airPurifierService.addCharacteristic(Characteristic.PM2_5Density);
    var airQualityCharacteristic = airPurifierService.addCharacteristic(Characteristic.AirQuality);
    services.push(airPurifierService);
    
    silentModeOnCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - SilentModeSwitch - getOn: " + result);
                
                if(result[0] === "silent") {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - SilentModeSwitch - getOn Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - SilentModeSwitch - setOn: " + value);
            if(value) {
                that.device.call("set_mode", ["silent"]).then(result => {
                    that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - SilentModeSwitch - setOn Result: " + result);
                    if(result[0] === "ok") {
                        targetAirPurifierStateCharacteristic.updateValue(Characteristic.TargetAirPurifierState.AUTO);
                        callback(null);
                        
                        if(Characteristic.Active.INACTIVE == activeCharacteristic.value) {
                            activeCharacteristic.updateValue(Characteristic.Active.ACTIVE);
                            currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                        }
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - SilentModeSwitch - setOn Error: " + err);
                    callback(err);
                });
            } else {
                if(Characteristic.Active.INACTIVE == activeCharacteristic.value) {
                    callback(null);
                } else {
                    that.device.call("set_mode", [Characteristic.TargetAirPurifierState.AUTO == targetAirPurifierStateCharacteristic.value ? "auto" : that.profile.manualMode(rotationSpeedCharacteristic.value)]).then(result => {
                        that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - SilentModeSwitch - setOn Result: " + result);
                        if(result[0] === "ok") {
                            callback(null);
                        } else {
                            callback(new Error(result[0]));
                        }
                    }).catch(function(err) {
                        that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - SilentModeSwitch - setOn Error: " + err);
                        callback(err);
                    });
                }
            }
        }.bind(this));
    
    activeCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", [that.profile.powerProperty]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - Active - getActive: " + result);
                
                if(result[0] === that.profile.offValue) {
                    callback(null, Characteristic.Active.INACTIVE);
                } else {
                    callback(null, Characteristic.Active.ACTIVE);
                }
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - Active - getActive Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - Active - setActive: " + value);
            that.device.call(...that.profile.powerCommand(value)).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - Active - setActive Result: " + result);
                if(result[0] === "ok") {
                    currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.IDLE);
                    callback(null);
                    if(value) {
                        currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                        that.device.call("get_prop", ["mode"]).then(result => {
                            if(result[0] === "silent") {
                                silentModeOnCharacteristic.updateValue(true);
                            } else {
                                silentModeOnCharacteristic.updateValue(false);
                            }
                        }).catch(function(err) {
                            that.platform.log.error("[XiaomiAirPlatform][ERROR]AirPurifier2AirPurifierAccessory - Active - setActive Error: " + err);
                        });
                    } else {
                        currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.INACTIVE);
                        silentModeOnCharacteristic.updateValue(false);
                    }
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - Active - setActive Error: " + err);
                callback(err);
            });
        }.bind(this));
       
    currentAirPurifierStateCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", [that.profile.powerProperty]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - CurrentAirPurifierState - getCurrentAirPurifierState: " + result);
                
                if(result[0] === that.profile.offValue) {
                    callback(null, Characteristic.CurrentAirPurifierState.INACTIVE);
                } else {
                    callback(null, Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                }
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - CurrentAirPurifierState - getCurrentAirPurifierState Error: " + err);
                callback(err);
            });
        }.bind(this));

    if (lockPhysicalControlsCharacteristic) {
        lockPhysicalControlsCharacteristic
            .on('get', function(callback) {
                that.device.call("get_prop", ["child_lock"]).then(result => {
                    that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - LockPhysicalControls - getLockPhysicalControls: " + result);
                    callback(null, result[0] === "on" ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
                }).catch(function(err) {
                    that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - LockPhysicalControls - getLockPhysicalControls Error: " + err);
                    callback(err);
                });
            }.bind(this))
            .on('set', function(value, callback) {
                that.device.call("set_child_lock", [value ? "on" : "off"]).then(result => {
                    that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - LockPhysicalControls - setLockPhysicalControls Result: " + result);
                    if(result[0] === "ok") {
                        callback(null);
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - LockPhysicalControls - setLockPhysicalControls Error: " + err);
                    callback(err);
                });
            }.bind(this));
    }
    targetAirPurifierStateCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - getTargetAirPurifierState: " + result);
                
                if(that.profile.isAutomatic(result[0])) {
                    callback(null, Characteristic.TargetAirPurifierState.AUTO);
                } else {
                    callback(null, Characteristic.TargetAirPurifierState.MANUAL);
                }
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - getTargetAirPurifierState: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState: " + value);
            that.device.call("set_mode", [Characteristic.TargetAirPurifierState.AUTO == value ? (silentModeOnCharacteristic.value ? "silent" : "auto") : that.profile.manualMode(rotationSpeedCharacteristic.value)]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState Result: " + result);
                if(result[0] === "ok") {
                    if(Characteristic.TargetAirPurifierState.AUTO == value || !that.profile.favorite) {
                        callback(null);
                    } else {
                        that.device.call("get_prop", ["favorite_level"]).then(result => {
                            that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + result);
                            silentModeOnCharacteristic.updateValue(false);
                            if(rotationSpeedCharacteristic.value <= result[0] * 10 && rotationSpeedCharacteristic.value > (result[0] - 1) * 10) {
                                callback(null);
                            } else {
                                rotationSpeedCharacteristic.updateValue(result[0] * 10);
                                callback(null);
                            }
                        }).catch(function(err) {
                            that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + err);
                            callback(err);
                        });
                    }
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState Error: " + err);
                callback(err);
            });
        }.bind(this));
    
    rotationSpeedCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", [that.profile.speedProperty]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - RotationSpeed - getRotationSpeed: " + result);
                callback(null, that.profile.readSpeed(result[0], rotationSpeedCharacteristic.value));
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - RotationSpeed - getRotationSpeed Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - RotationSpeed - setRotationSpeed set: " + value);
            if(value == 0) {
                callback(null);
            } else {
                var command = that.profile.speedCommand(value, rotationSpeedCharacteristic.value);
                if (!command) {
                    callback(null);
                    return;
                }
                that.device.call(...command).then(result => {
                    that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - RotationSpeed - setRotationSpeed Result: " + result);
                    if(result[0] === "ok") {
                        callback(null);
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + err);
                    callback(err);
                })
            }
        }.bind(this));

    if (this.profile.environment) {
        currentTemperatureCharacteristic.on('get', function(callback) {
            this.device.call("get_prop", ["temp_dec"]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - Temperature - getTemperature: " + result);
                callback(null, result[0] / 10);
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - Temperature - getTemperature Error: " + err);
                callback(err);
            });
        }.bind(this));
    
        currentRelativeHumidityCharacteristic
    	    .on('get', function(callback) {
    			this.device.call("get_prop", ["humidity"]).then(result => {
                    that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - Humidity - getHumidity: " + result);
                    callback(null, result[0]);
                }).catch(function(err) {
                    that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - Humidity - getHumidity Error: " + err);
                    callback(err);
                });
    	    }.bind(this));
    }
    pm25DensityCharacteristic
	    .on('get', function(callback) {
			this.device.call("get_prop", ["aqi"]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - aqi - getHumidity: " + result);
                callback(null, result[0]);
                
                var airQualityValue = Characteristic.AirQuality.UNKNOWN;
                if(result[0] <= 50) {
                    airQualityValue = Characteristic.AirQuality.EXCELLENT;
                } else if(result[0] > 50 && result[0] <= 100) {
                    airQualityValue = Characteristic.AirQuality.GOOD;
                } else if(result[0] > 100 && result[0] <= 200) {
                    airQualityValue = Characteristic.AirQuality.FAIR;
                } else if(result[0] > 200 && result[0] <= 300) {
                    airQualityValue = Characteristic.AirQuality.INFERIOR;
                } else if(result[0] > 300) {
                    airQualityValue = Characteristic.AirQuality.POOR;
                } else {
                    airQualityValue = Characteristic.AirQuality.UNKNOWN;
                }
                airQualityCharacteristic.updateValue(airQualityValue);
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - aqi - getHumidity Error: " + err);
                callback(err);
            });
	    }.bind(this));

    var filterChangeIndicationCharacteristic = airPurifierService.getCharacteristic(Characteristic.FilterChangeIndication);
    var filterLifeLevelCharacteristic = airPurifierService.addCharacteristic(Characteristic.FilterLifeLevel);

    filterChangeIndicationCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["filter1_life"]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - FilterChangeIndication - getFilterChangeIndication: " + result);
                callback(null, result[0] < 5 ? Characteristic.FilterChangeIndication.CHANGE_FILTER : Characteristic.FilterChangeIndication.FILTER_OK);
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - FilterChangeIndication - getFilterChangeIndication Error: " + err);
                callback(err);
            });
        }.bind(this));
    filterLifeLevelCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["filter1_life"]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - FilterLifeLevel - getFilterLifeLevel: " + result);
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - FilterLifeLevel - getFilterLifeLevel Error: " + err);
                callback(err);
            });
        }.bind(this));

    return services;
}

var XiaomiAirPurifierTemperatureAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.serialNumber = dThis.serialNumber;
    this.name = dThis.config['temperatureName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifierTemperatureAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
    services.push(infoService);
    
    var temperatureService = new Service.TemperatureSensor(this.name);
    temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getTemperature.bind(this))
    services.push(temperatureService);
    
    return services;
}

XiaomiAirPurifierTemperatureAccessory.prototype.getTemperature = function(callback) {
    var that = this;
    this.device.call("get_prop", ["temp_dec"]).then(result => {
        that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "TemperatureAccessory - Temperature - getTemperature: " + result);
        callback(null, result[0] / 10);
    }).catch(function(err) {
        that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "TemperatureAccessory - Temperature - getTemperature Error: " + err);
        callback(err);
    });
}

var XiaomiAirPurifierHumidityAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.serialNumber = dThis.serialNumber;
    this.name = dThis.config['humidityName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifierHumidityAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
    services.push(infoService);
    
    var humidityService = new Service.HumiditySensor(this.name);
    humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getHumidity.bind(this))
    services.push(humidityService);

    return services;
}

XiaomiAirPurifierHumidityAccessory.prototype.getHumidity = function(callback) {
    var that = this;
    this.device.call("get_prop", ["humidity"]).then(result => {
        that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "HumidityAccessory - Humidity - getHumidity: " + result);
        callback(null, result[0]);
    }).catch(function(err) {
        that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "HumidityAccessory - Humidity - getHumidity Error: " + err);
        callback(err);
    });
}


var XiaomiAirPurifierBuzzerSwitchAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.serialNumber = dThis.serialNumber;
    this.name = dThis.config['buzzerSwitchName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifierBuzzerSwitchAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
    services.push(infoService);
    
    var switchService = new Service.Switch(this.name);
    switchService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getBuzzerState.bind(this))
        .on('set', this.setBuzzerState.bind(this));
    services.push(switchService);

    return services;
}

XiaomiAirPurifierBuzzerSwitchAccessory.prototype.getBuzzerState = function(callback) {
    var that = this;
    this.device.call("get_prop", [this.profile.buzzerProperty]).then(result => {
        that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "BuzzerSpeakerAccessory - Mute - getBuzzerState: " + result);
        callback(null, that.profile.buzzerState(result[0]));
    }).catch(function(err) {
        that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "BuzzerSpeakerAccessory - Mute - getBuzzerState Error: " + err);
        callback(err);
    });
}

XiaomiAirPurifierBuzzerSwitchAccessory.prototype.setBuzzerState = function(value, callback) {
    var that = this;
    that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "BuzzerSpeakerAccessory - Mute - setBuzzerState: " + value);
    that.device.call(...that.profile.buzzerCommand(value)).then(result => {
        that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "BuzzerSpeakerAccessory - Mute - setBuzzerState Result: " + result);
        if(result[0] === "ok") {
            callback(null);
        } else {
            callback(new Error(result[0]));
        }
    }).catch(function(err) {
        that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "BuzzerSpeakerAccessory - Mute - setBuzzerState Error: " + err);
        callback(err);
    });
}

var XiaomiAirPurifierLEDBulbAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.serialNumber = dThis.serialNumber;
    this.name = dThis.config['ledBulbName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifierLEDBulbAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
    services.push(infoService);
    
    var switchLEDService = new Service.Lightbulb(this.name);
    var onCharacteristic = switchLEDService.getCharacteristic(Characteristic.On);
    
    onCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", ["led"]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "LEDBulbAccessory - switchLED - getLEDPower: " + result);
                callback(null, result[0] === "on" ? true : false);
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "LEDBulbAccessory - switchLED - getLEDPower Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "LEDBulbAccessory - switchLED - setLEDPower: " + value + ", nowValue: " + onCharacteristic.value);
            this.device.call("set_led", [value ? "on" : "off"]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "LEDBulbAccessory - switchLED - setLEDPower Result: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "LEDBulbAccessory - switchLED - setLEDPower Error: " + err);
                callback(err);
            });
        }.bind(this));
    services.push(switchLEDService);

    return services;
}

var XiaomiAirPurifierAirQualityAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.serialNumber = dThis.serialNumber;
    this.name = dThis.config['airQualityName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifierAirQualityAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];
    
    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
    services.push(infoService);
    
    var pmService = new Service.AirQualitySensor(this.name);
    var pm2_5Characteristic = pmService.addCharacteristic(Characteristic.PM2_5Density);
    pmService
        .getCharacteristic(Characteristic.AirQuality)
        .on('get', function(callback) {
            that.device.call("get_prop", ["aqi"]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirQualityAccessory - AirQuality - getAirQuality: " + result);
                
                pm2_5Characteristic.updateValue(result[0]);
                
                if(result[0] <= 50) {
                    callback(null, Characteristic.AirQuality.EXCELLENT);
                } else if(result[0] > 50 && result[0] <= 100) {
                    callback(null, Characteristic.AirQuality.GOOD);
                } else if(result[0] > 100 && result[0] <= 200) {
                    callback(null, Characteristic.AirQuality.FAIR);
                } else if(result[0] > 200 && result[0] <= 300) {
                    callback(null, Characteristic.AirQuality.INFERIOR);
                } else if(result[0] > 300) {
                    callback(null, Characteristic.AirQuality.POOR);
                } else {
                    callback(null, Characteristic.AirQuality.UNKNOWN);
                }
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirQualityAccessory - AirQuality - getAirQuality Error: " + err);
                callback(err);
            });
        }.bind(this));
    services.push(pmService);

    return services;
}

module.exports = XiaomiAirPurifier;
