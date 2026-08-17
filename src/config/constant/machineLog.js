module.exports = {
    SHIFT_TYPE: {
        DAY: 0,
        NIGHT: 1
    },
    MACHINE_TYPE_KEY_MAPPING: {
        "rapier": ["warp", "weft", "feeder", "manual", "other"],
        "airjet": ["h1", "h2", "warp", "other"],
        "waterjet": ["warp", "weft", "feeder", "manual", "other"],
        "circular": ["warp", "weft", "feeder", "manual", "other"]
    },
    RAPIER_DISPLAYS: ["nazon", "chitic", "pickwell"],
    AIRJET_DISPLAYS: ["biana"],
    DIRECT_DISPLAYS: ["haiwell", "picanolRapier", "picanolAirjet"],
};