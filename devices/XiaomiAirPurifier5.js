const MiotAirPurifier = require('../lib/MiotAirPurifier');

// Published MIoT schemas (including the sparse Auto/Sleep/Favorite values):
// https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:air-purifier:0000A007:xiaomi-mp5:2
// https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:air-purifier:0000A007:xiaomi-va5:2:0000D050
const COMMON = {
    power: [2, 1, 'boolean'], fault: [2, 2, 'number', 0, 255],
    mode: [2, 4, 'number', 0, 6], uv: [2, 7, 'boolean'],
    humidity: [3, 1, 'number', 0, 100], temperature: [3, 7, 'number', -30, 100],
    airQuality: [3, 3, 'number', 0, 5], pm25: [3, 4, 'number', 0, 1000],
    filterLife: [4, 1, 'number', 0, 100], buzzer: [6, 1, 'boolean'],
    screen: [7, 1, 'boolean'], brightness: [7, 2, 'number', 0, 1],
    childLock: [8, 1, 'boolean'], favoriteLevel: [9, 1, 'number', 0, 11]
};
const PROFILES = {
    'xiaomi.airp.mp5': {
        family: '5', fractionalProperties: ['temperature'],
        properties: { ...COMMON, anion: [2, 6, 'boolean'] }
    },
    'xiaomi.airp.va5': {
        family: 'pro', fractionalProperties: ['temperature'],
        properties: {
            ...COMMON, mode: [2, 3, 'number', 0, 6], uv: [2, 6, 'boolean'],
            temperature: [3, 2, 'number', -30, 100], pm25: [3, 4, 'number', 0, 600],
            screen: [6, 1, 'boolean'], brightness: [6, 2, 'number', 0, 1],
            buzzer: [7, 1, 'boolean'], favoriteLevel: [9, 1, 'number', 0, 9]
        }
    }
};

module.exports = function XiaomiAirPurifier5(platform, config, family = '5') {
    if (!['5', 'pro'].includes(family)) throw new Error(`Unknown Air Purifier 5 family: ${family}`);
    return new MiotAirPurifier(platform, config, {
        family, profiles: PROFILES,
        name: family === 'pro' ? 'Xiaomi Air Purifier 5 Pro' : 'Xiaomi Air Purifier 5',
        modes: { AUTO: 0, SLEEP: 3, FAVORITE: 5 },
        features: { environment: true, ionizer: family === '5', uv: true, screenPower: true, airQuality: true }
    });
};
