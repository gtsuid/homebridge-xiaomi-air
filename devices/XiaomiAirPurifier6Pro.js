const XiaomiAirPurifier6 = require('./XiaomiAirPurifier6');

module.exports = function XiaomiAirPurifier6Pro(platform, config) {
    return new XiaomiAirPurifier6(platform, config, 'pro');
};
