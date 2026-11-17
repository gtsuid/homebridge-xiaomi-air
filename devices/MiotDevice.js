const Base = require('./Base');

function validValue(value, property, fractional = false) {
    const [, , type, min, max] = property;
    if (typeof value !== type) return false;
    if (type !== 'number') return true;
    return Number.isFinite(value) && (fractional || Number.isInteger(value)) && value >= min && value <= max;
}

// MIoT property commands use the same local connection as the legacy handlers.
class MiotDevice extends Base {
    constructor(platform, config, { family, profiles, name, writable, readModes, writeModes }) {
        super();
        if (config.model && profiles[config.model]?.family !== family) {
            throw new Error(`Model ${config.model} is not supported by ${name}`);
        }
        this.init(platform, config);
        this.family = family;
        this.profiles = profiles;
        this.displayName = name;
        this.writable = writable;
        this.readModes = readModes;
        this.writeModes = writeModes;
    }

    async getProfile() {
        // Resolve the actual LAN model before choosing any read or write IDs.
        const model = await this.device.getModel();
        const profile = this.profiles[model];
        if (!profile || profile.family !== this.family || (this.config.model && this.config.model !== model)) {
            throw new Error(`Unsupported or mismatched ${this.displayName} model: ${model || 'unknown'}`);
        }
        return profile;
    }

    async read(key) {
        const profile = await this.getProfile();
        const property = profile.properties[key];
        if (!property) throw new Error(`${this.displayName} does not expose ${key}`);
        const [siid, piid] = property;
        const response = await this.device.call('get_properties', [{ did: key, siid, piid }]);
        const item = Array.isArray(response) && response.find(entry => entry && entry.siid === siid && entry.piid === piid);
        if (!item || item.code !== 0 || !validValue(item.value, property, profile.fractionalProperties.includes(key))) {
            throw new Error(`${this.displayName} property ${key} unavailable`);
        }
        if (key === 'mode' && this.readModes && !this.readModes.includes(item.value)) {
            throw new Error(`Unknown ${this.displayName} mode: ${item.value}`);
        }
        return item.value;
    }

    async write(key, value) {
        const profile = await this.getProfile();
        const property = profile.properties[key];
        if (!property || !this.writable.has(key)) throw new Error(`${this.displayName} property ${key} is not writable`);
        if (!validValue(value, property) || (key === 'mode' && this.writeModes && !this.writeModes.includes(value))) {
            throw new Error(`Invalid ${this.displayName} value for ${key}`);
        }
        const [siid, piid] = property;
        const response = await this.device.call('set_properties', [{ did: key, siid, piid, value }]);
        if (!Array.isArray(response) || response.length !== 1 || !response[0] || response[0].code !== 0 ||
            response[0].siid !== siid || response[0].piid !== piid) {
            throw new Error(`${this.displayName} rejected property ${key}`);
        }
    }
}

module.exports = MiotDevice;
