const MiotAirPurifier = require('../lib/MiotAirPurifier');

// Published MIoT schemas:
// https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:air-purifier:0000A007:xiaomi-ma6:1:0000D050
// https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:air-purifier:0000A007:xiaomi-va6:2:0000D050
const COMMON = {
    power: [2, 1, 'boolean'], fault: [2, 2, 'number', 0, 255],
    mode: [2, 3, 'number', 0, 6], uv: [2, 6, 'boolean'],
    humidity: [3, 1, 'number', 0, 100], temperature: [3, 2, 'number', -30, 100],
    airQuality: [3, 3, 'number', 0, 5], pm25: [3, 4, 'number', 0, 600],
    filterLife: [4, 1, 'number', 0, 100], buzzer: [7, 1, 'boolean'],
    screen: [6, 1, 'boolean'], brightness: [6, 2, 'number', 0, 2],
    childLock: [8, 1, 'boolean'], favoriteLevel: [9, 1, 'number', 0, 9]
};
const PROFILES = {
    // MC6 ionizer mapping retained from Aulos/xiaomi-miio-air-devices,
    // revision 32c4b6ba58c2c808a1c24eb86adc027b512171bf.
    'xiaomi.airp.mc6': {
        family: '6', fractionalProperties: ['temperature'],
        properties: { ...COMMON, anion: [2, 5, 'boolean'] }
    },
    'xiaomi.airp.ma6': {
        family: '6', fractionalProperties: ['temperature'], properties: COMMON
    },
    'xiaomi.airp.va6': {
        family: 'pro', fractionalProperties: ['temperature'],
        properties: {
            ...COMMON, mode: [2, 4, 'number', 0, 6], uv: [2, 7, 'boolean'],
            temperature: [3, 7, 'number', -30, 100], pm25: [3, 4, 'number', 0, 1000],
            screen: [7, 1, 'boolean'], brightness: [7, 2, 'number', 0, 2],
            buzzer: [6, 1, 'boolean'], favoriteLevel: [9, 1, 'number', 0, 10]
        }
    }
};

module.exports = function XiaomiAirPurifier6(platform, config, family = '6') {
    if (!['6', 'pro'].includes(family)) throw new Error(`Unknown Air Purifier 6 family: ${family}`);
    return new MiotAirPurifier(platform, config, {
        family, profiles: PROFILES,
        name: family === 'pro' ? 'Xiaomi Air Purifier 6 Pro' : 'Xiaomi Air Purifier 6',
        modes: { AUTO: 0, SLEEP: 3, FAVORITE: 5 },
        features: { environment: true, ionizer: family === '6' && config.model !== 'xiaomi.airp.ma6', uv: true, screenPower: true, brightnessLevels: [0, 2, 1], airQuality: true }
    });
};
