const XiaomiAirPurifier2 = require('./XiaomiAirPurifier2');

module.exports = function XiaomiAirPurifier2S(platform, config) {
    return new XiaomiAirPurifier2(platform, config, '2S');
};
