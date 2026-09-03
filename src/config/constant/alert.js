const DEFAULT_BEAM_THRESHOLDS = '1000,900,800,700,600,500,400,300,200,100,50,25,0';
const DEFAULT_MACHINE_STOPPED_MINUTES = '10,20';

const ALERT_CONFIG_SCHEMA = [
    {
        title: 'pickChange',
        apiKey: 'pickChange'
    },
    {
        title: 'maxSpeed',
        apiKey: 'maxSpeed'
    },
    {
        title: 'lowSpeed',
        apiKey: 'lowSpeed'
    },
    {
        title: 'beamLeft',
        apiKey: 'beamLeft',
        fields: [
            {
                title: 'beamLeftThreshold',
                apiKey: 'thresholds',
                placeholder: 'meters, comma separated (e.g. 100,200,300)',
                required: false,
                validation: 'commaSeparatedInt'
            }
        ]
    },
    {
        title: 'machineStopped',
        apiKey: 'machineStopped',
        fields: [
            {
                title: 'stopAlertMinutes',
                apiKey: 'minutes',
                placeholder: 'minutes, comma separated (e.g. 10,20)',
                required: false,
                validation: 'commaSeparatedInt'
            }
        ]
    }
];

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
            minutes: DEFAULT_MACHINE_STOPPED_MINUTES
        }
    }
};