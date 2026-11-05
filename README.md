# homebridge-xiaomi-air

Xiaomi air purifier and dehumidifier plugin for Homebridge.

**Note:** I have only a part of these devices, so some devices don't have tested. If you find bugs, please submit them to **[issues]()**.

## Supported Devices
### Air Purifier
| # | Device | Series | Model IDs |
|:-:|:-|:-|:-|
| 1 | Xiaomi Air Purifier | 1 | `zhimi.airpurifier.v1` |
| 2 | Xiaomi Air Purifier Pro | 1 | `zhimi.airpurifier.v6`, `zhimi.airpurifier.v7` |
| 3 | Xiaomi Air Purifier 2 | 2 | `zhimi.airpurifier.m1`, `zhimi.airpurifier.m2` |
| 4 | Xiaomi Air Purifier 2S | 2 | `zhimi.airpurifier.ma2` |
| 5 | Xiaomi Air Purifier 3 | 3 | `zhimi.airpurifier.ma4` |
| 6 | Xiaomi Air Purifier 3H | 3 | `zhimi.airpurifier.mb3`, `zhimi.airp.mb3a` |
| 7 | Xiaomi Air Purifier 3C | 3 | `zhimi.airpurifier.mb4`, `zhimi.airp.mb4a` |
| 8 | Xiaomi Air Purifier 4 | 4 | `zhimi.airp.mb5`, `zhimi.airp.mb5a` |
| 9 | Xiaomi Air Purifier 4 Lite | 4 | `zhimi.airpurifier.rma1`, `zhimi.airpurifier.rma2`, `zhimi.airp.rmb1` |
| 10 | Xiaomi Air Purifier 4 Pro | 4 | `zhimi.airp.va2`, `zhimi.airp.vb4` |
| 11 | Xiaomi Air Purifier 4 Compact | 4 | `zhimi.airp.cpa4`, `xiaomi.airp.cpa4` |
| 12 | Xiaomi Air Purifier 6 | 6 | `xiaomi.airp.mc6` |

### Dehumidifier
| # | Device | Model IDs |
|:-:|:-|:-|
| 1 | Xiaomi Smart Dehumidifier Lite | `xiaomi.derh.lite` |

## Configuration
You can config the plugin via Homebridge UI or manually edit the ``JSON Config``.

For configuration example, please refer to file ``sampleConfig.json``.

## Credits
- [Nick Farina](https://x.com/nfarina), the original creator of [Homebridge](https://github.com/homebridge/homebridge)
- [YinHangCode](https://github.com/YinHangCode), the author of [homebridge-mi-airpurifier](https://github.com/YinHangCode/homebridge-mi-airpurifier)
- [Teemu R.](https://github.com/rytilahti), the author of [python-miio](https://github.com/rytilahti/python-miio)
- [Paweł Zubrycki](https://github.com/Aulos), the author of [xiaomi-miio-air-devices](https://github.com/Aulos/xiaomi-miio-air-devices)

## Changelog
See [CHANGELOG.md](CHANGELOG.md) for release notes and version history.