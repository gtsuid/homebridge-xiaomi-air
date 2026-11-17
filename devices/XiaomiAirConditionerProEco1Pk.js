const MiotAirConditioner = require('../lib/MiotAirConditioner');

// https://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:air-conditioner:0000A004:xiaomi-ra4r00:2
const MODEL = 'xiaomi.airc.ra4r00';
const FAMILY = 'air-conditioner';
const MODE = { COOL: 2, DRY: 3, FAN: 4 };
const PROPERTIES = {
    power: [2, 1, 'boolean'],
    mode: [2, 2, 'number', 2, 4],
    targetTemperature: [2, 4, 'number', 16, 31],
    fanLevel: [3, 2, 'number', 0, 7],
    fanPercent: [10, 1, 'number', 0, 101],
    horizontalSwing: [3, 3, 'boolean'],
    verticalSwing: [3, 4, 'boolean'],
    temperature: [4, 7, 'number', -50, 150],
    compressorFrequency: [12, 11, 'number', 0, 200]
};

const DEFINITION = {
    model: MODEL,
    name: 'Xiaomi Mijia Air Conditioner',
    profile: {
        family: FAMILY,
        properties: PROPERTIES,
        fractionalProperties: ['temperature', 'targetTemperature', 'compressorFrequency']
    },
    writable: new Set(['power', 'mode', 'targetTemperature', 'fanLevel', 'fanPercent', 'horizontalSwing', 'verticalSwing']),
    modes: MODE,
    targetTemperatureStep: 0.5
};

module.exports = function XiaomiAirConditionerProEco1Pk(platform, config) {
    return new MiotAirConditioner(platform, config, DEFINITION);
};
