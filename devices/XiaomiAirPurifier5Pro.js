const XiaomiAirPurifier5 = require('./XiaomiAirPurifier5');

module.exports = function XiaomiAirPurifier5Pro(platform, config) {
    return new XiaomiAirPurifier5(platform, config, 'pro');
};
