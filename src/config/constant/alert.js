const DEFAULT_BEAM_THRESHOLDS = '1000,900,800,700,600,500,400,300,200,100,50,25,0';
const DEFAULT_MACHINE_STOPPED_MINUTES = '10,20';

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