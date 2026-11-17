const MiotDehumidifier = require('../lib/MiotDehumidifier');

// https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:dehumidifier:0000A02D:xiaomi-lite:1
const MODEL = 'xiaomi.derh.lite';
const MODES = { SMART: 0, SLEEP: 1, CLOTHES_DRYING: 2 };
const PROPERTIES = {
    power: [2, 1, 'boolean'], fault: [2, 2, 'number', 0, 9],
    mode: [2, 3, 'number', 0, 2], targetHumidity: [2, 5, 'number', 40, 70],
    humidity: [3, 1, 'number', 0, 100], temperature: [3, 2, 'number', -30, 100],
    buzzer: [4, 1, 'boolean'], led: [5, 1, 'boolean'],
    brightness: [5, 2, 'number', 0, 2], childLock: [6, 1, 'boolean']
};
const WRITABLE = new Set(['power', 'mode', 'targetHumidity', 'buzzer', 'led', 'brightness', 'childLock']);

const DEFINITION = {
    model: MODEL,
    name: 'Xiaomi Smart Dehumidifier Lite',
    profile: { family: 'dehumidifier-lite', properties: PROPERTIES, fractionalProperties: ['temperature'] },
    writable: WRITABLE,
    modes: MODES
};

module.exports = function XiaomiDehumidifierLite(platform, config) {
    return new MiotDehumidifier(platform, config, DEFINITION);
};
