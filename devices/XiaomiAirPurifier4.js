const MiotAirPurifier = require('../lib/MiotAirPurifier');

// MIoT protocol facts checked against published model schemas at miot-spec.org.
// Reference: https://github.com/rytilahti/python-miio/blob/master/miio/integrations/zhimi/airpurifier/airpurifier_miot.py
const COMMON = {
    power: [2, 1, 'boolean'], fault: [2, 2, 'number', 0, 255],
    mode: [2, 4, 'number', 0, 3], filterLife: [4, 1, 'number', 0, 100],
    buzzer: [6, 1, 'boolean'], childLock: [8, 1, 'boolean'],
    brightness: [13, 2, 'number', 0, 2]
};
const ENVIRONMENT = {
    humidity: [3, 1, 'number', 0, 100], temperature: [3, 7, 'number', -30, 100]
};
function profile(family, favorite, max, overrides = {}) {
    return {
        family,
        fractionalProperties: family === '4' || family === 'pro' ? ['temperature', 'pm25'] : ['temperature'],
        properties: {
            ...COMMON,
            ...(family !== 'compact' ? ENVIRONMENT : {}),
            ...(family === '4' || family === 'pro' ? { anion: [2, 6, 'boolean'] } : {}),
            pm25: [3, 4, 'number', 0, family === '4' || family === 'pro' ? 1000 : 600],
            mode: [2, 4, 'number', 0, family === '4' || family === 'pro' ? 3 : 2],
            favoriteLevel: [...favorite, 'number', 0, max],
            ...overrides
        }
    };
}
const PROFILES = {
    'zhimi.airp.mb5': profile('4', [9, 5], 11),
    'zhimi.airp.mb5a': profile('4', [9, 5], 11),
    'zhimi.airp.va2': profile('pro', [9, 5], 11),
    'zhimi.airp.vb4': profile('pro', [9, 5], 11),
    'zhimi.airpurifier.rma1': profile('lite', [9, 2], 14),
    'zhimi.airp.rmb1': profile('lite', [9, 11], 14),
    'zhimi.airpurifier.rma2': profile('lite', [11, 1], 14, {
        buzzer: [5, 1, 'boolean'], childLock: [6, 1, 'boolean'], brightness: [7, 2, 'number', 0, 2]
    }),
    'zhimi.airp.cpa4': profile('compact', [9, 11], 14),
    'xiaomi.airp.cpa4': profile('compact', [9, 11], 14)
};
const NAMES = { '4': 'Xiaomi Air Purifier 4', lite: 'Xiaomi Air Purifier 4 Lite',
    pro: 'Xiaomi Air Purifier 4 Pro', compact: 'Xiaomi Air Purifier 4 Compact' };

module.exports = function XiaomiAirPurifier4(platform, config, family = '4') {
    if (!NAMES[family]) throw new Error(`Unknown Air Purifier 4 family: ${family}`);
    return new MiotAirPurifier(platform, config, {
        family, profiles: PROFILES, name: NAMES[family],
        features: { environment: family !== 'compact', ionizer: family === '4' || family === 'pro' }
    });
};
