const enTranslation = require('../../public/translation/en.json');

const DEFAULT_BEAM_THRESHOLDS = '1000,900,800,700,600,500,400,300,200,100,50,25,0';
const DEFAULT_MACHINE_STOPPED_MINUTES = '10,20';


const ALERT_CONFIG_SCHEMA = {
    pickChange: {
        title: "dyn_pickChange"
    },
    maxSpeed: {
        title: "dyn_maxSpeed"
    },
    lowSpeed: {
        title: "dyn_lowSpeed"
    },
    beamLeft: {
        title: "dyn_beamLeft",
        fields: {
            thresholds: {
                title: "dyn_beamLeftThreshold",
                placeholder: "dyn_beamLeftThresholdPlaceholder",
                required: false
            }
        }
    },
    machineStopped: {
        title: "dyn_machineStopped",
        fields: {
            minutes: {
                title: "dyn_stopAlertMinutes",
                placeholder: "dyn_stopAlertMinutesPlaceholder",
                required: false
            },
            warpMinutes: {
                title: "dyn_warpStopMinutes",
                placeholder: "dyn_stopAlertMinutesPlaceholder",
                required: false
            },
            weftMinutes: {
                title: "dyn_weftStopMinutes",
                placeholder: "dyn_stopAlertMinutesPlaceholder",
                required: false
            },
            feederMinutes: {
                title: "dyn_feederStopMinutes",
                placeholder: "dyn_stopAlertMinutesPlaceholder",
                required: false
            },
            otherMinutes: {
                title: "dyn_otherStopMinutes",
                placeholder: "dyn_stopAlertMinutesPlaceholder",
                required: false
            }
        }
    }
};

const ALERT_CONFIG_SCHEMA_WEB = JSON.parse(
    JSON.stringify(ALERT_CONFIG_SCHEMA)
);

for (const obj of Object.values(ALERT_CONFIG_SCHEMA_WEB)) {
    obj.title = enTranslation[obj.title];

    if (!obj.fields) continue;

    for (const fieldObj of Object.values(obj.fields)) {
        fieldObj.title = enTranslation[fieldObj.title];
        fieldObj.placeholder = enTranslation[fieldObj.placeholder];
    }
}

// only for system admin pages
const CHANNEL_SCHEMA = {
    notification: {
        title: "Notification"
    },
    whatsapp: {
        title: "WhatsApp"
    }
};


module.exports = {
    ALERT_TYPES: {
        PICK_CHANGE: 'pickChange',
        MAX_SPEED: 'maxSpeed',
        LOW_SPEED: 'lowSpeed',
        BEAM_LEFT: 'beamLeft',
        MACHINE_STOPPED: 'machineStopped'
    },
    DEFAULT_BEAM_THRESHOLDS,
    DEFAULT_MACHINE_STOPPED_MINUTES,
    ALERT_CONFIG_SCHEMA,
    ALERT_CONFIG_SCHEMA_WEB,
    CHANNEL_SCHEMA,
    DEFAULT_ALERT_FLAGS: {
        pickChange: {
            notification: true,
            whatsapp: false
        },
        maxSpeed: {
            notification: true,
            whatsapp: false
        },
        lowSpeed: {
            notification: true,
            whatsapp: false
        },
        beamLeft: {
            notification: true,
            whatsapp: false,
            thresholds: DEFAULT_BEAM_THRESHOLDS
        },
        machineStopped: {
            notification: true,
            whatsapp: false,
            minutes: DEFAULT_MACHINE_STOPPED_MINUTES,
            warpMinutes: '',
            weftMinutes: '',
            feederMinutes: '',
            otherMinutes: ''
        }
    }
};