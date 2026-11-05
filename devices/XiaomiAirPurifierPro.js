const XiaomiAirPurifier = require('./XiaomiAirPurifier');

module.exports = function XiaomiAirPurifierPro(platform, config) {
    return new XiaomiAirPurifier(platform, config, 'pro');
};
