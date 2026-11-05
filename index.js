const XiaomiDehumidifierLite = require('./devices/XiaomiDehumidifierLite');
const XiaomiAirPurifier = require('./devices/XiaomiAirPurifier');
const XiaomiAirPurifierPro = require('./devices/XiaomiAirPurifierPro');
const XiaomiAirPurifier2 = require('./devices/XiaomiAirPurifier2');
const XiaomiAirPurifier2S = require('./devices/XiaomiAirPurifier2S');
const XiaomiAirPurifier3 = require('./devices/XiaomiAirPurifier3');
const XiaomiAirPurifier3H = require('./devices/XiaomiAirPurifier3H');
const XiaomiAirPurifier3C = require('./devices/XiaomiAirPurifier3C');
const XiaomiAirPurifier4 = require('./devices/XiaomiAirPurifier4');
const XiaomiAirPurifier4Lite = require('./devices/XiaomiAirPurifier4Lite');
const XiaomiAirPurifier4Pro = require('./devices/XiaomiAirPurifier4Pro');
const XiaomiAirPurifier4Compact = require('./devices/XiaomiAirPurifier4Compact');
const XiaomiAirPurifier6 = require('./devices/XiaomiAirPurifier6');

var packageFile = require("./package.json");
var PlatformAccessory, Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
    PlatformAccessory = homebridge.platformAccessory;
    Accessory = homebridge.hap.Accessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform('homebridge-xiaomi-air', 'XiaomiAirPlatform', XiaomiAirPlatform);
}

function XiaomiAirPlatform(log, config, api) {
    if(null == config) {
        return;
    }
    
    this.Accessory = Accessory;
    this.PlatformAccessory = PlatformAccessory;
    this.Service = Service;
    this.Characteristic = Characteristic;
    this.UUIDGen = UUIDGen;
    
    this.log = log;
    this.config = config;

    if (api) {
        this.api = api;
    }
    
    this.log.info("[XiaomiAirPlatform][INFO]*******************************************************************");
    this.log.info("[XiaomiAirPlatform][INFO]          XiaomiAirPlatform v%s", packageFile.version);
    this.log.info("[XiaomiAirPlatform][INFO]*******************************************************************");
    this.log.info("[XiaomiAirPlatform][INFO]start success...");
}

XiaomiAirPlatform.prototype = {
    accessories: function(callback) {
        var myAccessories = [];

        var deviceCfgs = this.config['deviceCfgs'];
        if(deviceCfgs instanceof Array) {
            for (var i = 0; i < deviceCfgs.length; i++) {
                var deviceCfg = deviceCfgs[i];
                if(null == deviceCfg['type'] || "" == deviceCfg['type']) {
                  continue;
                }
                if(null == deviceCfg['token'] || "" == deviceCfg['token'] || null == deviceCfg['ip'] || "" == deviceCfg['ip']) {
                    continue;
                }
                
                if (deviceCfg['type'] == "MiAirPurifier") {
                    new XiaomiAirPurifier(this, deviceCfg).forEach(function(accessory, index, arr){
                        myAccessories.push(accessory);
                    });
                } else if (deviceCfg['type'] == "MiAirPurifier2") {
                    new XiaomiAirPurifier2(this, deviceCfg).forEach(function(accessory, index, arr){
                        myAccessories.push(accessory);
                    });
                } else if (deviceCfg['type'] == "MiAirPurifierPro") {
                    new XiaomiAirPurifierPro(this, deviceCfg).forEach(function(accessory, index, arr){
                        myAccessories.push(accessory);
                    });
                } else if (deviceCfg['type'] == "MiAirPurifier2S") {
                    new XiaomiAirPurifier2S(this, deviceCfg).forEach(function(accessory, index, arr){
                        myAccessories.push(accessory);
                    });
                } else if (deviceCfg['type'] === 'XiaomiAirPurifier3' || deviceCfg['type'] === 'MiAirPurifier3') {
                    myAccessories.push(...new XiaomiAirPurifier3(this, deviceCfg));
                } else if (deviceCfg['type'] === 'XiaomiAirPurifier3H' || deviceCfg['type'] === 'MiAirPurifier3H') {
                    myAccessories.push(...new XiaomiAirPurifier3H(this, deviceCfg));
                } else if (deviceCfg['type'] === 'XiaomiAirPurifier3C' || deviceCfg['type'] === 'MiAirPurifier3C') {
                    myAccessories.push(...new XiaomiAirPurifier3C(this, deviceCfg));
                } else if (deviceCfg['type'] === 'XiaomiAirPurifier4' || deviceCfg['type'] === 'MiAirPurifier4') {
                    myAccessories.push(...new XiaomiAirPurifier4(this, deviceCfg));
                } else if (deviceCfg['type'] === 'XiaomiAirPurifier4Lite' || deviceCfg['type'] === 'MiAirPurifier4Lite') {
                    myAccessories.push(...new XiaomiAirPurifier4Lite(this, deviceCfg));
                } else if (deviceCfg['type'] === 'XiaomiAirPurifier4Pro' || deviceCfg['type'] === 'MiAirPurifier4Pro') {
                    myAccessories.push(...new XiaomiAirPurifier4Pro(this, deviceCfg));
                } else if (deviceCfg['type'] === 'XiaomiAirPurifier4Compact' || deviceCfg['type'] === 'MiAirPurifier4Compact') {
                    myAccessories.push(...new XiaomiAirPurifier4Compact(this, deviceCfg));
                } else if (deviceCfg['type'] === 'XiaomiDehumidifierLite') {
                    myAccessories.push(...new XiaomiDehumidifierLite(this, deviceCfg));
                } else if (deviceCfg['type'] === 'XiaomiAirPurifier6' || deviceCfg['type'] === 'MiAirPurifier6') {
                    myAccessories.push(...new XiaomiAirPurifier6(this, deviceCfg));
                } else {
                }
            }
            this.log.info("[XiaomiAirPlatform][INFO]device size: " + deviceCfgs.length + ", accessories size: " + myAccessories.length);
        }
        
        callback(myAccessories);
    }
}
