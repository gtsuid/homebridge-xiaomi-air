const XiaomiAirPurifier4 = require('./XiaomiAirPurifier4');

module.exports = function XiaomiAirPurifier4Compact(platform, config) {
    return new XiaomiAirPurifier4(platform, config, 'compact');
};
