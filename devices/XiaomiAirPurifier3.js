const MiotAirPurifier = require('../lib/MiotAirPurifier');

// Protocol facts from published MIoT schemas (zhimi-ma4:2, zhimi-mb3:2,
// zhimi-mb3a:1, zhimi-mb4:1, zhimi-mb4a:1). Saved schema sources are in
// test/fixtures/air-purifier3-schemas.json. Independent reference:
// https://github.com/rytilahti/python-miio/blob/master/miio/integrations/zhimi/airpurifier/airpurifier_miot.py
const STANDARD = {
    power: [2, 2, 'boolean'], fault: [2, 1, 'number', 0, 255],
    mode: [2, 5, 'number', 0, 3], humidity: [3, 7, 'number', 0, 100],
    temperature: [3, 8, 'number', -40, 125], pm25: [3, 6, 'number', 0, 600],
    filterLife: [4, 3, 'number', 0, 100], buzzer: [5, 1, 'boolean'],
    brightness: [6, 1, 'number', 0, 2], childLock: [7, 1, 'boolean'],
    favoriteLevel: [10, 10, 'number', 0, 14]
};
const THREE_C = {
    power: [2, 1, 'boolean'], mode: [2, 4, 'number', 0, 2],
    pm25: [3, 4, 'number', 0, 600], filterLife: [4, 1, 'number', 0, 100],
    buzzer: [6, 1, 'boolean'], brightness: [7, 2, 'number', 0, 8],
    childLock: [8, 1, 'boolean'], favoriteRpm: [9, 3, 'number', 300, 2200]
};
const standard = family => ({ family, fractionalProperties: ['temperature', 'pm25'], properties: STANDARD });
const threeC = () => ({ family: '3C', fractionalProperties: [], properties: THREE_C, speedProperty: 'favoriteRpm' });
const PROFILES = {
    'zhimi.airpurifier.ma4': standard('3'),
    'zhimi.airpurifier.mb3': standard('3H'),
    'zhimi.airp.mb3a': standard('3H'),
    'zhimi.airpurifier.mb4': threeC(),
    'zhimi.airp.mb4a': threeC()
};
const NAMES = { '3': 'Xiaomi Air Purifier 3', '3H': 'Xiaomi Air Purifier 3H', '3C': 'Xiaomi Air Purifier 3C' };

module.exports = function XiaomiAirPurifier3(platform, config, family = '3') {
    if (!NAMES[family]) throw new Error(`Unknown Air Purifier 3 family: ${family}`);
    return new MiotAirPurifier(platform, config, {
        family, profiles: PROFILES, name: NAMES[family],
        features: {
            environment: family !== '3C', ionizer: false,
            temperatureRange: [-40, 125],
            brightnessLevels: family === '3C' ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [2, 1, 0],
            // The 3C fault property is an undocumented string, not a numeric code.
            fault: family !== '3C'
        }
    });
};
