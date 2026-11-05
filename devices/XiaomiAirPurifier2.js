const Base = require('./Base');

const inherits = require('util').inherits;

// Shared legacy controls; only these protocol details vary between 2 and 2S.
const SPEED_STEPS_2S = [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 95, 100];

function speedFromFavorite2S(favoriteLevel, cachedSpeed) {
    const level = parseInt(favoriteLevel);
    return cachedSpeed > SPEED_STEPS_2S[level - 1] && cachedSpeed <= SPEED_STEPS_2S[level]
        ? cachedSpeed : SPEED_STEPS_2S[level];
}

const PROFILES = {
    '2': {
        model: 'AirPurifier2',
        label: 'XiaomiAirPurifier2',
        powerProperty: 'mode',
        offValue: 'idle',
        readSpeed: level => level,
        refreshSpeed: (level, cachedSpeed) => cachedSpeed <= level * 10 && cachedSpeed > (level - 1) * 10
            ? cachedSpeed : level * 10,
        favoriteFromSpeed: speed => parseInt(speed / 10) < 10 ? parseInt(speed / 10) + 1 : 10,
        buzzerProperty: 'buzzer',
        buzzerState: value => value === 'on' ? 1 : 0,
        led: { brightness: true, readProperty: 'led_b', writeMethod: 'set_led_b', isOn: value => value !== 2 }
    },
    '2S': {
        model: 'AirPurifier2S',
        label: 'XiaomiAirPurifier2S',
        powerProperty: 'power',
        offValue: 'off',
        readSpeed: speedFromFavorite2S,
        refreshSpeed: speedFromFavorite2S,
        favoriteFromSpeed: speed => {
            for (let level = 1; level < SPEED_STEPS_2S.length; level++) {
                if (speed > SPEED_STEPS_2S[level - 1] && speed <= SPEED_STEPS_2S[level]) return level;
            }
            return 1;
        },
        buzzerProperty: 'volume',
        buzzerState: value => value === 'on',
        led: { brightness: false, readProperty: 'led', writeMethod: 'set_led', isOn: value => value === 'on' }
    }
};

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;

var XiaomiAirPurifier2 = function(platform, config, variant = '2') {
    this.profile = PROFILES[variant];
    if (!this.profile) throw new Error('Unknown Air Purifier 2 variant: ' + variant);
    this.init(platform, config);
    
    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;
    
    
    this.accessories = {};
    if(!this.config['airPurifierDisable'] && this.config['airPurifierName'] && this.config['airPurifierName'] != "" && this.config['silentModeSwitchName'] && this.config['silentModeSwitchName'] != "") {
        this.accessories['airPurifierAccessory'] = new XiaomiAirPurifier2AirPurifierAccessory(this);
    }
    if(!this.config['temperatureDisable'] && this.config['temperatureName'] && this.config['temperatureName'] != "") {
        this.accessories['temperatureAccessory'] = new XiaomiAirPurifier2TemperatureAccessory(this);
    }
    if(!this.config['humidityDisable'] && this.config['humidityName'] && this.config['humidityName'] != "") {
        this.accessories['humidityAccessory'] = new XiaomiAirPurifier2HumidityAccessory(this);
    }
    if(!this.config['buzzerSwitchDisable'] && this.config['buzzerSwitchName'] && this.config['buzzerSwitchName'] != "") {
        this.accessories['buzzerSwitchAccessory'] = new XiaomiAirPurifier2BuzzerSwitchAccessory(this);
    }
    if(!this.config['ledBulbDisable'] && this.config['ledBulbName'] && this.config['ledBulbName'] != "") {
        this.accessories['ledBulbAccessory'] = new XiaomiAirPurifier2LEDBulbAccessory(this);
    }
    if(!this.config['airQualityDisable'] && this.config['airQualityName'] && this.config['airQualityName'] != "") {
        this.accessories['airQualityAccessory'] = new XiaomiAirPurifier2AirQualityAccessory(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[XiaomiAirPlatform][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    return accessoriesArr;
}
inherits(XiaomiAirPurifier2, Base);

var XiaomiAirPurifier2AirPurifierAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.name = dThis.config['airPurifierName'];
    this.silentModeSwitchDisable = dThis.config['silentModeSwitchDisable'];
    this.silentModeSwitchName = dThis.config['silentModeSwitchName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifier2AirPurifierAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, "Undefined")
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
    services.push(infoService);

    var silentModeSwitch = new Service.Switch(this.silentModeSwitchName);
    var silentModeOnCharacteristic = silentModeSwitch.getCharacteristic(Characteristic.On);
    if(!this.silentModeSwitchDisable) {
        services.push(silentModeSwitch);
    }
    
    var airPurifierService = new Service.AirPurifier(this.name);
    var activeCharacteristic = airPurifierService.getCharacteristic(Characteristic.Active);
    var currentAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.CurrentAirPurifierState);
    var targetAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.TargetAirPurifierState);
    var lockPhysicalControlsCharacteristic = airPurifierService.addCharacteristic(Characteristic.LockPhysicalControls);
    var rotationSpeedCharacteristic = airPurifierService.addCharacteristic(Characteristic.RotationSpeed);
    
    var currentTemperatureCharacteristic = airPurifierService.addCharacteristic(Characteristic.CurrentTemperature);
	var currentRelativeHumidityCharacteristic = airPurifierService.addCharacteristic(Characteristic.CurrentRelativeHumidity);
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
                    that.device.call("set_mode", [Characteristic.TargetAirPurifierState.AUTO == targetAirPurifierStateCharacteristic.value ? "auto" : "favorite"]).then(result => {
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
            that.device.call("set_power", [value ? "on" : "off"]).then(result => {
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
                            that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - Active - setActive Error: " + err);
                            // The power write already completed; only log refresh failures.
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
        
    targetAirPurifierStateCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - getTargetAirPurifierState: " + result);
                
                if(result[0] === "favorite") {
                    callback(null, Characteristic.TargetAirPurifierState.MANUAL);
                } else {
                    callback(null, Characteristic.TargetAirPurifierState.AUTO);
                }
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - getTargetAirPurifierState: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState: " + value);
            that.device.call("set_mode", [Characteristic.TargetAirPurifierState.AUTO == value ? (silentModeOnCharacteristic.value ? "silent" : "auto") : "favorite"]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState Result: " + result);
                if(result[0] === "ok") {
                    if(Characteristic.TargetAirPurifierState.AUTO == value) {
                        callback(null);
                    } else {
                        that.device.call("get_prop", ["favorite_level"]).then(result => {
                            that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "AirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + result);
                            silentModeOnCharacteristic.updateValue(false);
                            rotationSpeedCharacteristic.updateValue(that.profile.refreshSpeed(result[0], rotationSpeedCharacteristic.value));
                            callback(null);
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
            that.device.call("get_prop", ["favorite_level"]).then(result => {
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
                that.device.call("set_level_favorite", [that.profile.favoriteFromSpeed(value)]).then(result => {
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

    // var filterMaintenanceService = new Service.FilterMaintenance(this.name);
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
    // services.push(filterMaintenanceService);

    return services;
}

var XiaomiAirPurifier2TemperatureAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.name = dThis.config['temperatureName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifier2TemperatureAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, "Undefined")
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
    services.push(infoService);
    
    var temperatureService = new Service.TemperatureSensor(this.name);
    temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getTemperature.bind(this))
    services.push(temperatureService);
    
    return services;
}

XiaomiAirPurifier2TemperatureAccessory.prototype.getTemperature = function(callback) {
    var that = this;
    this.device.call("get_prop", ["temp_dec"]).then(result => {
        that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "TemperatureAccessory - Temperature - getTemperature: " + result);
        callback(null, result[0] / 10);
    }).catch(function(err) {
        that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "TemperatureAccessory - Temperature - getTemperature Error: " + err);
        callback(err);
    });
}

var XiaomiAirPurifier2HumidityAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.name = dThis.config['humidityName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifier2HumidityAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, "Undefined")
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
    services.push(infoService);
    
    var humidityService = new Service.HumiditySensor(this.name);
    humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getHumidity.bind(this))
    services.push(humidityService);

    return services;
}

XiaomiAirPurifier2HumidityAccessory.prototype.getHumidity = function(callback) {
    var that = this;
    this.device.call("get_prop", ["humidity"]).then(result => {
        that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "HumidityAccessory - Humidity - getHumidity: " + result);
        callback(null, result[0]);
    }).catch(function(err) {
        that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "HumidityAccessory - Humidity - getHumidity Error: " + err);
        callback(err);
    });
}

var XiaomiAirPurifier2BuzzerSwitchAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.name = dThis.config['buzzerSwitchName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifier2BuzzerSwitchAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, "Undefined")
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

XiaomiAirPurifier2BuzzerSwitchAccessory.prototype.getBuzzerState = function(callback) {
    var that = this;
    this.device.call("get_prop", [this.profile.buzzerProperty]).then(result => {
        that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "BuzzerSwitchAccessory - BuzzerSwitch - getBuzzerState: " + result);
        callback(null, that.profile.buzzerState(result[0]));
    }).catch(function(err) {
        that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "BuzzerSwitchAccessory - BuzzerSwitch - getBuzzerState Error: " + err);
        callback(err);
    });
}

XiaomiAirPurifier2BuzzerSwitchAccessory.prototype.setBuzzerState = function(value, callback) {
    var that = this;
    that.device.call("set_buzzer", [value ? "on" : "off"]).then(result => {
        that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "BuzzerSwitchAccessory - BuzzerSwitch - setBuzzerState Result: " + result);
        if(result[0] === "ok") {
            callback(null);
        } else {
            callback(new Error(result[0]));
        }
    }).catch(function(err) {
        that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "BuzzerSwitchAccessory - BuzzerSwitch - setBuzzerState Error: " + err);
        callback(err);
    });
}

var XiaomiAirPurifier2LEDBulbAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.name = dThis.config['ledBulbName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifier2LEDBulbAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, "Undefined")
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);
    services.push(infoService);
    
    var switchLEDService = new Service.Lightbulb(this.name);
    var onCharacteristic = switchLEDService.getCharacteristic(Characteristic.On);
    var brightnessCharacteristic = this.profile.led.brightness
        ? switchLEDService.addCharacteristic(Characteristic.Brightness) : null;
    
    onCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", [this.profile.led.readProperty]).then(result => {
                that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "LEDBulbAccessory - switchLED - getLEDPower: " + result);
                callback(null, that.profile.led.isOn(result[0]));
            }).catch(function(err) {
                that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "LEDBulbAccessory - switchLED - getLEDPower Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "LEDBulbAccessory - switchLED - setLEDPower: " + value + ", nowValue: " + onCharacteristic.value);
            var level = that.profile.led.brightness
                ? (value ? that.getLevelByBrightness(brightnessCharacteristic.value) : 2)
                : (value ? "on" : "off");
            that.setLed(level, callback);
        }.bind(this));
    if (brightnessCharacteristic) {
        brightnessCharacteristic
            .on('get', function(callback) {
                this.device.call("get_prop", [this.profile.led.readProperty]).then(result => {
                    that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "LEDBulbAccessory - switchLED - getLEDPower: " + result);
                    if(result[0] == 0) {
                        if(brightnessCharacteristic.value > 50 && brightnessCharacteristic.value <= 100) {
                            callback(null, brightnessCharacteristic.value);
                        } else {
                            callback(null, 100);
                        }
                    } else if(result[0] == 1) {
                        if(brightnessCharacteristic.value > 0 && brightnessCharacteristic.value <= 50) {
                            callback(null, brightnessCharacteristic.value);
                        } else {
                            callback(null, 50);
                        }
                    } else if(result[0] == 2) {
                        callback(null, 0);
                    }
                }).catch(function(err) {
                    that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "LEDBulbAccessory - switchLED - getLEDPower Error: " + err);
                    callback(err);
                });
            }.bind(this));
    }
    services.push(switchLEDService);

    return services;
}

XiaomiAirPurifier2LEDBulbAccessory.prototype.setLed = function(led_b, callback) {
    var that = this;
    that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "LEDBulbAccessory - switchLED - setLedB: " + led_b);
    this.device.call(this.profile.led.writeMethod, [led_b]).then(result => {
        that.platform.log.debug("[XiaomiAirPlatform][DEBUG]" + that.profile.label + "LEDBulbAccessory - switchLED - setLEDBrightness Result: " + result);
        if(result[0] === "ok") {
            callback(null);
        } else {
            callback(new Error(result[0]));
        }
    }).catch(function(err) {
        that.platform.log.error("[XiaomiAirPlatform][ERROR]" + that.profile.label + "LEDBulbAccessory - switchLED - setLEDBrightness Error: " + err);
        callback(err);
    });
}

XiaomiAirPurifier2LEDBulbAccessory.prototype.getLevelByBrightness = function(brightness) {
    if(brightness == 0) {
        return 2;
    } else if(brightness > 0 && brightness <= 50) {
        return 1;
    } else if (brightness > 50 && brightness <= 100) {
        return 0;
    }
}

var XiaomiAirPurifier2AirQualityAccessory = function(dThis) {
    this.device = dThis.device;
    this.profile = dThis.profile;
    this.firmwareRevision = dThis.firmwareRevision;
    this.name = dThis.config['airQualityName'];
    this.platform = dThis.platform;
}

XiaomiAirPurifier2AirQualityAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];
    
    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, this.profile.model)
        .setCharacteristic(Characteristic.SerialNumber, "Undefined")
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

module.exports = XiaomiAirPurifier2;
