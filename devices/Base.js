const miio = require('miio');
const packageVersion = require('../package.json').version;

// Keep the existing raw command interface while connecting through miio 0.15.
class MiioDevice {
    constructor(options, api) {
        this.options = options;
        this.connection = null;
        this.closed = false;
        if (api) {
            api.once('shutdown', () => {
                this.destroy().catch(() => {});
            });
        }
    }

    async connect() {
        if (this.closed) {
            throw new Error('Device connection is closed');
        }
        if (!this.connection) {
            this.connection = miio.device(this.options).then(device => {
                device.once('thing:destroyed', () => {
                    this.connection = null;
                });
                return device;
            }).catch(error => {
                this.connection = null;
                throw error;
            });
        }
        const device = await this.connection;
        if (this.closed) {
            throw new Error('Device connection is closed');
        }
        return device;
    }

    async call(method, args) {
        const device = await this.connect();
        return device.call(method, args);
    }

    async getModel() {
        const device = await this.connect();
        return device.miioModel;
    }

    async destroy() {
        this.closed = true;
        const connection = this.connection;
        this.connection = null;
        if (connection) {
            const device = await connection;
            await device.destroy();
        }
    }
}

var Base = function() {
    this.platform = null;
}

Base.prototype.init = function(platform, config) {
    this.platform = platform;
    this.config = config;
    const revision = config.firmwareRevision;
    this.firmwareRevision = typeof revision === 'string' && revision.trim()
        ? revision.trim()
        : typeof revision === 'number' && Number.isFinite(revision)
            ? String(revision)
            : packageVersion;
    this.device = new MiioDevice({
        address: config.ip,
        token: config.token
    }, platform.api);
}

Base.prototype.obj2array = function(obj) {
    var array = [];
    for(var item in obj) {
        array.push(obj[item]);
    }
    return array;
}

module.exports = Base;
