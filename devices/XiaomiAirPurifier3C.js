const XiaomiAirPurifier3 = require('./XiaomiAirPurifier3');

module.exports = function XiaomiAirPurifier3C(platform, config) {
    return new XiaomiAirPurifier3(platform, config, '3C');
};
