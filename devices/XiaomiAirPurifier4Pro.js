const XiaomiAirPurifier4 = require('./XiaomiAirPurifier4');

module.exports = function XiaomiAirPurifier4Pro(platform, config) {
    return new XiaomiAirPurifier4(platform, config, 'pro');
};
