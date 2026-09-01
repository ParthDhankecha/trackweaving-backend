const moment = require('moment');

const machineService = require('./machineService');
const alertConfigService = require('./alertConfigService');
const utilService = require('./utilService');

/**
 * On beam replenishment (beamLeft increased), close the open beamLeft record
 * and open a new cycle for the freshly loaded beam.
 */
async function recordBeamCycleChange(body, machine, newBeam) {
    const endDate = body.updatedTime ? new Date(body.updatedTime) : new Date();
    const endProduction = body.pieceLengthM ?? 0;

    const openBeam = await beamLeftModel.findOne({
        machineId: body.machineId,
        workspaceId: body.workspaceId,
        endDate: null,
        isDeleted: false
    }).sort({ createdAt: -1 });

    let quality = machine?.quality;
    if (quality === undefined) {
        const machineDoc = await machineService.findOne(
            { _id: body.machineId },
            { useLean: true, projection: { quality: 1 } }
        );
        quality = machineDoc?.quality || null;
    }

    if (openBeam) {
        const logs = await machineLogsModel.find({
            machineId: body.machineId,
            workspaceId: body.workspaceId,
            isDeleted: false,
            shiftDate: {
                $gte: moment(openBeam.startDate).startOf('day').toDate(),
                $lte: endDate
            }
        }).sort({ shiftDate: 1, shift: 1 }).select({ pieceLengthM: 1 }).lean();

        let productionMtr = 0;
        for (let i = 0; i < logs.length; i++) {
            const m = logs[i].pieceLengthM || 0;
            // First shift of the beam cycle: only meters produced after the beam started
            productionMtr += (i === 0) ? Math.max(0, m - (openBeam.startProduction || 0)) : m;
        }

        openBeam.endDate = endDate;
        openBeam.endProduction = endProduction;
        openBeam.productionMtr = productionMtr;
        if (quality !== openBeam.quality) openBeam.quality = quality;
        await openBeam.save();
    }

    await beamLeftModel.create({
        machineId: body.machineId,
        workspaceId: body.workspaceId,
        shift: String(body.shift),
        quality,
        startDate: endDate,
        startProduction: endProduction,
        beamLength: newBeam
    });
}

const toUint32 = (hi, lo) => (((hi << 16) >>> 0) + (lo >>> 0)) >>> 0;
const get16 = (r, csvRegister) => { return r[csvRegister - 1] ?? 0; }
const register = {
    nazon: {
        speedRpm: 5010,
        stopCode: 5027,
        stateCode: 5028,
        efficiency: 5017,
        pieceLenCm: 5013,
        shiftWeftCountHi: 5016,
        shiftWeftCountLo: 5015,
        totalWeftHundredsHi: 5020,
        totalWeftHundredsLo: 5019,
        currentDensity: 5035,
        beamLeft: 5023,
        alarms: [5029, 5030, 5031, 5032],
        stopsCount: {
            warp: { count: 5061, duration: 5057 },
            weft: { count: 5062, duration: 5058 },
            feeder: { count: 5063, duration: 5059 },
            other: { count: 5064, duration: 5060 }
        },
        runTime: { hours: 5055, minutes: 5056 },
        shift: 5012
    },
    chitic: {
        speedRpm: 5003,
        stopCode: 5023,
        stateCode: 5013,
        efficiency: 5044,
        pieceLenCm: 5045,
        pieceLenHi: 5046,
        pieceLenDecimals: 3,
        shiftWeftCountHi: 5048,
        shiftWeftCountLo: 5047,
        totalWeftHundredsHi: null,
        totalWeftHundredsLo: null,
        currentDensity: 5002,
        beamLeft: 5022,
        alarms: [],
        stopsCount: {
            warp: { count: 5036, duration: 5040 },
            weft: { count: 5037, duration: 5041 },
            manual: { count: 5038, duration: 5042 },
            feeder: { count: 5049, duration: 5050 },
            other: { count: 5039, duration: 5043 }
        },
        runTime: { hours: 5034, minutes: 5035 },
        shift: 5005
    },
    pickwell: {
        speedRpm: 5003,
        stopCode: 5023,
        stateCode: 5013,
        efficiency: 5044,
        pieceLenCm: 5045,
        pieceLenHi: 5046,
        pieceLenLo: 5045,
        pieceLenDecimals: 3,
        shiftWeftCountHi: 5050,
        shiftWeftCountLo: 5049,
        totalWeftHundredsHi: null,
        totalWeftHundredsLo: null,
        currentDensity: 5002,
        beamLeft: 5022,
        alarms: [5014, 5015, 5016, 5017, 5018, 5019],
        stopsCount: {
            warp: { count: 5036, duration: 5040 },
            weft: { count: 5037, duration: 5041 },
            manual: { count: 5038, duration: 5042 },
            other: { count: 5039, duration: 5043 }
        },
        runTime: { hours: 5034, minutes: 5035 },
        shift: 5005
    },
    biana: {
        "shift": 1,
        "0": {
            speedRpm: 43,
            stopCode: 7,
            stateCode: 8,
            efficiency: 44,
            pieceLenHi: 61,
            pieceLenLo: 60,
            shiftWeftCountHi: 59,
            shiftWeftCountLo: 58,
            totalWeftHundredsHi: null,
            totalWeftHundredsLo: null,
            currentDensity: 57,
            beamLeftHi: 16,
            beamLeftLo: 17,
            alarms: [],
            stopsCount: {
                warp: { count: 47, duration: 48 },
                h1: { count: 49, duration: 50 },
                h2: { count: 51, duration: 52 },
                other: { count: 53, duration: 54 }
            },
            runTime: 45,
        },
        "1": {
            speedRpm: 73,
            stopCode: 7,
            stateCode: 8,
            efficiency: 74,
            pieceLenHi: 91,
            pieceLenLo: 90,
            shiftWeftCountHi: 89,
            shiftWeftCountLo: 88,
            totalWeftHundredsHi: null,
            totalWeftHundredsLo: null,
            currentDensity: 87,
            beamLeftHi: 16,
            beamLeftLo: 17,
            alarms: [],
            stopsCount: {
                warp: { count: 77, duration: 78 },
                h1: { count: 79, duration: 80 },
                h2: { count: 81, duration: 82 },
                other: { count: 83, duration: 84 }
            },
            runTime: 75,
        }
    },
    haiwell: {
        shift: 1,
        stopCode: 2,
        speedRpm: 4,
        currentDensity: 5,
        beamLeft: 6,
        beamCompletionDate: 7,
        pieceLengthM: 8,
        picksCurrentShift: 9,
        efficiencyPercent: 10,
        runTime: 11,
        stopsCount: {
            warp: { count: 12, duration: 13 },
            h1: { count: 14, duration: 15 },
            h2: { count: 16, duration: 17 },
            other: { count: 18, duration: 19 }
        }
    },
    picanolRapier: {
        shift: 1,
        quality: 2,
        stopCode: 3,
        runTime: 4,
        efficiencyPercent: 5,
        currentDensity: 6,
        pieceLengthM: 7,
        picksCurrentShift: 8,
        beamLeft: 9,
        initialBeamLeft: 10,
        beamCompletionDate: 11,
        speedRpm: 22,
        stopsCount: {
            warp: { count: 12, duration: 13 },
            weft: { count: 14, duration: 15 },
            feeder: { count: 16, duration: 17 },
            manual: { count: 18, duration: 19 },
            other: { count: 20, duration: 21 }
        }
    },
    picanolAirjet: {
        shift: 1,
        quality: 2,
        stopCode: 3,
        runTime: 4,
        efficiencyPercent: 5,
        currentDensity: 6,
        pieceLengthM: 7,
        picksCurrentShift: 8,
        beamLeft: 9,
        initialBeamLeft: 10,
        beamCompletionDate: 11,
        speedRpm: 20,
        stopsCount: {
            warp: { count: 12, duration: 13 },
            h1: { count: 14, duration: 15 },
            h2: { count: 16, duration: 17 },
            other: { count: 18, duration: 19 }
        }
    },
    itema: {
        shift: 1,
        stopCode: 2,
        runTime: 3,
        efficiencyPercent: 4,
        currentDensity: 5,
        pieceLengthM: 6,
        picksCurrentShift: 7,
        speedRpm: 18,
        stopsCount: {
            warp: { count: 8, duration: 9 },
            weft: { count: 10, duration: 11 },
            feeder: { count: 12, duration: 13 },
            manual: { count: 14, duration: 15 },
            other: { count: 16, duration: 17 }
        }
    }
};

function getPowerOffStopCode() {
    return global.config.POWER_OFF_STOP_CODE || 9999;
}

function getPowerOffStopReason() {
    return global.config.POWER_OFF_STOP_REASON || 'Power Off';
}

function isPowerOffStop(stopCode) {
    return Number(stopCode) === getPowerOffStopCode();
}

function resolveShiftDate(shift, updatedTime) {
    if (shift == 0) {
        return moment(updatedTime).startOf('day');
    }
    if (shift == 1) {
        return moment().hour() < 11 ? moment().subtract(1, 'day').startOf('day') : moment().startOf('day');
    }
    return null;
}

function buildPowerOffFields(body) {
    const fields = {
        powerOff: true,
        stop: getPowerOffStopCode(),
        speedRpm: 0
    };
    if (body.lastStopTime) fields.lastStopTime = body.lastStopTime;
    if (body.lastStartTime) fields.lastStartTime = body.lastStartTime;
    if (body.stopsData) fields.stopsData = body.stopsData;
    if (body.stopCount != null) fields.stopCount = body.stopCount;
    if (body.workspaceId) fields.workspaceId = body.workspaceId;
    return fields;
}

async function upsertShiftLog(body, shiftDate, options = {}) {
    const { updateMachineQuality = true } = options;
    if (updateMachineQuality) {
        const machine = await machineService.findOne({ _id: body.machineId }, { useLean: true, projection: { quality: 1 } });
        body.quality = machine?.quality || null;
    }

    // Sum running speeds for shift avg; skip while stopped (or zero RPM).
    const speedRpm = Number(body.speedRpm) || 0;
    if (!speedRpm) {
        delete body.speedRpm;
    }
    delete body.totalSpeed;
    delete body.totalSpeedCount;

    const update = { $set: body };
    if (body.stop === 0 && speedRpm > 0) {
        update.$inc = { totalSpeed: speedRpm, totalSpeedCount: 1 };
    }
    await machineLogsModel.findOneAndUpdate({
        machineId: body.machineId, workspaceId: body.workspaceId, shift: body.shift, shiftDate: shiftDate
    }, update, { upsert: true });
}

/**
 * Power-off must not rewrite latest logs from stale/empty HMI rawData
 * (that restores the last live snapshot and can zero production fields).
 * Only mark the machine stopped with stop code 9999.
 */
async function applyPowerOffLog(body) {
    const powerOffFields = buildPowerOffFields(body);

    const machineLog = await machineLatestLogsModel.findOneAndUpdate(
        { machineId: body.machineId },
        {
            $set: powerOffFields,
            $setOnInsert: {
                machineId: body.machineId,
                shift: body.shift ?? 0
            }
        },
        { upsert: true, returnDocument: 'before' }
    );

    const shift = machineLog?.shift ?? body.shift;
    const shiftDate = resolveShiftDate(shift, body.updatedTime || machineLog?.updatedAt);

    if (shift != null && shiftDate) {
        const shiftLogUpdate = {
            machineId: body.machineId,
            workspaceId: body.workspaceId,
            shift,
            stop: getPowerOffStopCode(),
            powerOff: true
        };
        if (body.lastStopTime) shiftLogUpdate.lastStopTime = body.lastStopTime;
        if (body.lastStartTime) shiftLogUpdate.lastStartTime = body.lastStartTime;
        await upsertShiftLog(shiftLogUpdate, shiftDate, { updateMachineQuality: false });
    }
}

module.exports = {
    async create(body) {
        if (body.powerOff === true) {
            await applyPowerOffLog(body);
            return;
        }

        body.powerOff = false;

        let machineLog = await machineLatestLogsModel.findOneAndUpdate({ machineId: body.machineId }, body, { upsert: true, returnDocument: 'before' });
        let shiftDate;
        if (body.displayType == 'biana' && body.speedRpm == 0) {
            return;
        }
        shiftDate = resolveShiftDate(body.shift, body.updatedTime);
        if (machineLog) {
            if (machineLog.shift != body.shift) {
                if (body.prevData && body.prevData.speedRpm != 0 && body.prevData.efficiencyPercent != 0) {
                    if (!body.prevData.speedRpm || body.prevData.speedRpm == 0) {
                        delete body.prevData.speedRpm;
                    }
                    await machineLogsModel.findOneAndUpdate({ machineId: body.machineId, workspaceId: body.workspaceId }, body.prevData, { sort: { createdAt: -1 } });
                }
                body.shiftDate = shiftDate;
                body.stopsData = {
                    warp: [],
                    weft: [],
                    feeder: [],
                    manual: [],
                    other: [],
                    h1: [],
                    h2: []
                };
                if (body.displayType == 'biana' && body.beamLeft == 0) {
                    console.log(JSON.stringify(body));
                    return;
                }

                await upsertShiftLog(body, shiftDate);
            } else {
                await upsertShiftLog(body, shiftDate, { updateMachineQuality: false });
            }
            await this.checkAlertNotification(machineLog, body);
        } else {
            body.shiftDate = shiftDate;
            body.stopsData = {
                warp: [],
                weft: [],
                feeder: [],
                manual: [],
                other: [],
                h1: [],
                h2: []
            };

            await upsertShiftLog(body, shiftDate);
        }
    },

    async updateNightShiftLogs() {
        let logs = await machineLatestLogsModel.find({ shift: global.config.SHIFT_TYPE.NIGHT }).lean();
        let logIds = [];
        let shiftDate = moment().subtract(1, 'day').startOf('day');
        for (let log of logs) {
            logIds.push(log._id);
        }
        await machineLatestLogsModel.updateMany({ _id: { $in: logIds } }, {
            shift: global.config.SHIFT_TYPE.DAY,
            shiftDate: shiftDate,
            stopsData: {
                warp: [],
                weft: [],
                feeder: [],
                manual: [],
                other: [],
                h1: [],
                h2: []
            },
            stopsCount: {
                warp: { count: 0, duration: 0 },
                weft: { count: 0, duration: 0 },
                feeder: { count: 0, duration: 0 },
                manual: { count: 0, duration: 0 },
                other: { count: 0, duration: 0 },
                h1: { count: 0, duration: 0 },
                h2: { count: 0, duration: 0 }
            },
            speedRpm: 0,
            stop: 0,
            loomStateCode: 0,
            efficiencyPercent: 0,
            picksCurrentShift: 0,
            picksTotal: 0,
            pieceLengthM: 0,
            beamLeft: 0,
            setPicks: 0,
            alarmsActive: [],
            runTime: ''
        });
        await machineLatestLogsModel.updateMany(
            { _id: { $in: logIds }, powerOff: true },
            { $set: { stop: getPowerOffStopCode(), speedRpm: 0 } }
        );
        console.log("Night shift logs updated to day shift successfully.");
    },

    async updateDayShiftLogs() {
        let logs = await machineLatestLogsModel.find({ shift: global.config.SHIFT_TYPE.DAY }).lean();
        let logIds = [];
        let shiftDate = moment().startOf('day');
        for (let log of logs) {
            logIds.push(log._id);
        }
        await machineLatestLogsModel.updateMany({ _id: { $in: logIds } }, {
            shift: global.config.SHIFT_TYPE.NIGHT,
            shiftDate: shiftDate,
            stopsData: {
                warp: [],
                weft: [],
                feeder: [],
                manual: [],
                other: [],
                h1: [],
                h2: []
            },
            stopsCount: {
                warp: { count: 0, duration: 0 },
                weft: { count: 0, duration: 0 },
                feeder: { count: 0, duration: 0 },
                manual: { count: 0, duration: 0 },
                other: { count: 0, duration: 0 },
                h1: { count: 0, duration: 0 },
                h2: { count: 0, duration: 0 }
            },
            speedRpm: 0,
            stop: 0,
            loomStateCode: 0,
            efficiencyPercent: 0,
            picksCurrentShift: 0,
            picksTotal: 0,
            pieceLengthM: 0,
            beamLeft: 0,
            setPicks: 0,
            alarmsActive: [],
            runTime: ''
        });
        await machineLatestLogsModel.updateMany(
            { _id: { $in: logIds }, powerOff: true },
            { $set: { stop: getPowerOffStopCode(), speedRpm: 0 } }
        );
    },

    async checkAlertNotification(machineLog, body) {
        let isPickChanged = false;
        let isMaxSpeedAlert = false;
        let isMinSpeedAlert = false;
        const alertUpdate = {};
        const machineKey = String(body.machineId);

        if ((machineLog.setPicks && body.setPicks) && machineLog.setPicks !== body.setPicks) {
            isPickChanged = true;
        }

        // Speed alerts only while machine is running — stopped looms report ~0 RPM
        // and would otherwise spam low-speed alerts every cooldown window.
        const alertConfig = global.config.MACHINE_ALERT_CONFIG && global.config.MACHINE_ALERT_CONFIG[machineKey];
        if (alertConfig && alertConfig.sendAlert && body.stop === 0) {
            const lastSpeedAlertTime = alertConfig.lastSpeedAlertTime;
            const canSendSpeedAlert = !lastSpeedAlertTime || moment().diff(moment(lastSpeedAlertTime), 'minutes') > 10;
            if (canSendSpeedAlert) {
                if (body.speedRpm > alertConfig.speedLimit + 10) {
                    isMaxSpeedAlert = true;
                } else if (body.speedRpm < alertConfig.speedLimit - 10) {
                    isMinSpeedAlert = true;
                }
            }
        }

        const needsMachineUsers = isPickChanged || isMaxSpeedAlert || isMinSpeedAlert;
        let machine = null, users = [];
        const alertTypes = global.config.ALERT_TYPES || {};

        if (needsMachineUsers) {
            machine = await machineService.findOne({ _id: body.machineId }, {
                projection: { machineCode: 1, machineName: 1, quality: 1 },
                useLean: true,
            });
            users = await alertConfigService.getUsersForAlert({
                workspaceId: body.workspaceId
            });
        }

        if (machine && users.length) {
            const activeTypes = [];
            const pickKey = alertTypes.PICK_CHANGE || 'pickChange';
            const maxKey = alertTypes.MAX_SPEED || 'maxSpeed';
            const lowKey = alertTypes.LOW_SPEED || 'lowSpeed';

            if (isPickChanged) activeTypes.push(pickKey);
            if (isMaxSpeedAlert) activeTypes.push(maxKey);
            if (isMinSpeedAlert) activeTypes.push(lowKey);

            try {
                const recipientsByType = await alertConfigService.filterUsersForAlert(body.workspaceId, users, activeTypes);
                if (isPickChanged) {
                    try {
                        const recipients = recipientsByType[pickKey];
                        if (recipients && (recipients.notification.length || recipients.whatsapp.length)) {
                            await alertConfigService.dispatchAlert({
                                machineId: body.machineId,
                                workspaceId: body.workspaceId,
                                title: `Picks changed on ${machine.machineCode}`,
                                description: `Picks changed from ${machineLog.setPicks} to ${body.setPicks}`,
                                recipients
                            });
                        }
                    } catch (err) {
                        utilService.errLog(`Pick alert error: ${err.message}`);
                    }
                }
                if (isMaxSpeedAlert) {
                    try {
                        const recipients = recipientsByType[maxKey];
                        if (recipients && (recipients.notification.length || recipients.whatsapp.length)) {
                            await alertConfigService.dispatchAlert({
                                machineId: body.machineId,
                                workspaceId: body.workspaceId,
                                title: `Max speed alert on ${machine.machineCode}`,
                                description: `Machine speed ${body.speedRpm} RPM exceeded the limit of ${alertConfig.speedLimit} RPM`,
                                recipients
                            });
                            global.config.MACHINE_ALERT_CONFIG[body.machineId].lastSpeedAlertTime = moment();
                        }
                    } catch (err) {
                        utilService.errLog(`Max speed alert error: ${err.message}`);
                    }
                }
                if (isMinSpeedAlert) {
                    try {
                        const recipients = recipientsByType[lowKey];
                        if (recipients && (recipients.notification.length || recipients.whatsapp.length)) {
                            await alertConfigService.dispatchAlert({
                                machineId: body.machineId,
                                workspaceId: body.workspaceId,
                                title: `Low speed alert on ${machine.machineCode}`,
                                description: `Machine speed ${body.speedRpm} RPM is below the limit of ${alertConfig.speedLimit} RPM`,
                                recipients
                            });
                            global.config.MACHINE_ALERT_CONFIG[body.machineId].lastSpeedAlertTime = moment();
                        }
                    } catch (err) {
                        utilService.errLog(`Min speed alert error: ${err.message}`);
                    }
                }
            } catch (err) {
                utilService.errLog(`Alert notification error: ${err.message}`);
            }
        }

        // ── Beam left threshold alerts ────────────────────────────────────────
        // Fire when beamLeft crosses from above to below a threshold
        // (prevBeamLeft > threshold && newBeamLeft <= threshold).
        // If a single update skips multiple thresholds, notify only for the
        // lowest one reached. Each threshold fires at most once per beam cycle
        // (until beamLeft increases past it again on replenishment).
        const prevBeam = machineLog.beamLeft;
        const newBeam = body.beamLeft;
        if (prevBeam != null && newBeam != null && prevBeam > 0 && newBeam > 0) {
            const beamThresholds = await alertConfigService.getUnionBeamThresholds(body.workspaceId);
            const notified = new Set(machineLog.beamAlertNotifiedThresholds || []);
            let beamStateChanged = false;

            if (newBeam > prevBeam) {
                for (const t of [...notified]) {
                    if (newBeam > t) {
                        notified.delete(t);
                        beamStateChanged = true;
                    }
                }

                // Beam replenishment: close previous beam cycle and open a new one
                try {
                    if (!machine) {
                        machine = await machineService.findOne(
                            { _id: body.machineId },
                            { useLean: true, projection: { machineCode: 1, machineName: 1, quality: 1 } }
                        );
                    }
                    await recordBeamCycleChange(body, machine, newBeam);
                } catch (err) {
                    utilService.errLog(`Beam cycle record error: ${err.message}`);
                }
            }

            const crossed = beamThresholds.filter(t => prevBeam > t && newBeam <= t);
            if (crossed.length) {
                const threshold = Math.min(...crossed);
                if (!notified.has(threshold)) {
                    try {
                        if (!machine) {
                            machine = await machineService.findOne(
                                { _id: body.machineId },
                                { useLean: true, projection: { machineCode: 1, machineName: 1 } }
                            );
                        }
                        if (!users.length) {
                            users = await alertConfigService.getUsersForAlert({
                                workspaceId: body.workspaceId
                            });
                        }

                        // Retry later if workspace has no active users yet.
                        if (users.length && machine) {
                            const recipients = await alertConfigService.filterUsersForBeamThreshold(
                                body.workspaceId,
                                users,
                                threshold
                            );
                            if (recipients.notification.length || recipients.whatsapp.length) {
                                await alertConfigService.dispatchAlert({
                                    machineId: body.machineId,
                                    workspaceId: body.workspaceId,
                                    title: `Beam Left Alert — ${machine.machineCode}`,
                                    description: `Beam left has reached ${newBeam} meters`,
                                    recipients
                                });
                            }
                            // Mark notified even when all users opted out of beamLeft,
                            // to avoid re-checking on every subsequent log.
                            notified.add(threshold);
                            beamStateChanged = true;
                        }
                    } catch (err) {
                        utilService.errLog(`Beam alert error: ${err.message}`);
                    }
                }
            }

            if (beamStateChanged) {
                alertUpdate.beamAlertNotifiedThresholds = [...notified];
            }
        }

        // ── Machine stopped duration alerts (10 min / 20 min) ─────────────────
        // Each threshold fires at most once per stop cycle. State resets when the
        // machine starts running again, or when a new stop begins after running.
        const wasRunning = machineLog.stop === 0;
        const isRunning = body.stop === 0;
        const wasStopped = !wasRunning;
        const isStopped = !isRunning;
        let stopNotified = new Set(machineLog.stopAlertNotifiedMinutes || []);
        let stopStateChanged = false;

        if (wasRunning && isStopped) {
            stopNotified = new Set();
            alertUpdate.stopAlertNotifiedMinutes = [];
            stopStateChanged = true;
        } else if (wasStopped && isRunning) {
            stopNotified = new Set();
            alertUpdate.stopAlertNotifiedMinutes = [];
            stopStateChanged = true;
        }

        if (isStopped) {
            const stopSince = body.lastStopTime || machineLog.lastStopTime || body.updatedTime;

            if (stopSince) {
                const stopMinutes = await alertConfigService.getUnionStopMinutes(body.workspaceId);
                const stoppedMinutes = moment().diff(moment(stopSince), 'minutes');
                const minutesToNotify = stopMinutes.filter(
                    minutes => stoppedMinutes >= minutes && !stopNotified.has(minutes)
                );

                if (minutesToNotify.length) {
                    try {
                        if (!machine) {
                            machine = await machineService.findOne(
                                { _id: body.machineId },
                                { useLean: true, projection: { machineCode: 1, machineName: 1, displayType: 1 } }
                            );
                        }
                        if (!users.length) {
                            users = await alertConfigService.getUsersForAlert({
                                workspaceId: body.workspaceId
                            });
                        }

                        if (users.length && machine) {
                            const stopReason = this.getStopReason(body.stop, body.displayType || machine.displayType);

                            for (const minutes of minutesToNotify) {
                                const recipients = await alertConfigService.filterUsersForStopMinute(
                                    body.workspaceId,
                                    users,
                                    minutes,
                                    stoppedMinutes
                                );
                                if (recipients.notification.length || recipients.whatsapp.length) {
                                    await alertConfigService.dispatchAlert({
                                        machineId: body.machineId,
                                        workspaceId: body.workspaceId,
                                        title: `Machine stopped for ${minutes}+ minutes — ${machine.machineCode}`,
                                        description: `${machine.machineCode} has been stopped for ${stoppedMinutes} minutes. Reason: ${stopReason}`,
                                        recipients
                                    });
                                }
                                stopNotified.add(minutes);
                                stopStateChanged = true;
                            }
                        }
                    } catch (err) {
                        utilService.errLog(`Stop duration alert error: ${err.message}`);
                    }
                }
            }
        }

        if (stopStateChanged) {
            alertUpdate.stopAlertNotifiedMinutes = [...stopNotified];
        }


        if (Object.keys(alertUpdate).length) {
            await machineLatestLogsModel.findOneAndUpdate(
                { machineId: body.machineId },
                { $set: alertUpdate }
            );
        }
    },

    async find(condition, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            limit: undefined,
            skip: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = machineLogsModel.find({ ...condition, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.limit) query.limit(queryOptions.limit);
        if (queryOptions.skip) query.skip(queryOptions.skip);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findLatestLogs(condition, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            limit: undefined,
            skip: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = machineLatestLogsModel.find({ ...condition, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.limit) query.limit(queryOptions.limit);
        if (queryOptions.skip) query.skip(queryOptions.skip);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findOne(condition, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = machineLogsModel.findOne({ ...condition, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findByIdAndUpdate(_id, data) {
        return await machineLogsModel.findByIdAndUpdate({ _id: _id }, data, { new: true });
    },

    async findByIdAndDelete(_id) {
        return await machineLogsModel.findByIdAndUpdate({ _id: _id }, { isDeleted: true }, { new: true });
    },

    async countDocuments(filter = {}) {
        return await machineLogsModel.countDocuments({ ...filter, isDeleted: false });
    },

    async getDistinctQualities(workspaceId) {
        const qualities = await machineLogsModel.distinct('quality', {
            workspaceId,
            isDeleted: false,
            quality: { $nin: [null, ''] }
        });
        return (qualities || [])
            .map(q => String(q).trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    },

    parseBlock(body, displayType = 'nazon') {
        if (global.config.RAPIER_DISPLAYS.includes(displayType)) {
            const at = (lw) => body[lw - 4999];

            const speedRpm = register[displayType].speedRpm ? at(register[displayType].speedRpm) : 0;
            const stopCode = register[displayType].stopCode ? at(register[displayType].stopCode) : 0;
            const stateCode = register[displayType].stateCode ? at(register[displayType].stateCode) : 0;
            let efficiency = register[displayType].efficiency ? at(register[displayType].efficiency) : 0;
            if (displayType == "chitic") {
                efficiency = efficiency / 10;
            }

            let pieceLenMeters = 0;
            if (register[displayType].pieceLenHi && register[displayType].pieceLenLo) {
                const wovenLen = toUint32(at(register[displayType].pieceLenHi), at(register[displayType].pieceLenLo));
                const decimals = register[displayType].pieceLenDecimals || 2;
                pieceLenMeters = parseFloat((wovenLen / Math.pow(10, decimals)).toFixed(2));
            } else {
                let pieceLenCm = register[displayType].pieceLenCm ? at(register[displayType].pieceLenCm) : 0;
                if (displayType == "chitic") {
                    pieceLenCm = pieceLenCm / 10;
                }
                pieceLenMeters = parseFloat((pieceLenCm / 100).toFixed(2));
            }

            let shiftWeftCount = register[displayType].shiftWeftCountHi && register[displayType].shiftWeftCountLo ? toUint32(at(register[displayType].shiftWeftCountHi), at(register[displayType].shiftWeftCountLo)) : 0;
            if (displayType == "pickwell") {
                shiftWeftCount = shiftWeftCount * 10;
            }
            const totalWeftHundreds = register[displayType].totalWeftHundredsHi && register[displayType].totalWeftHundredsLo ? toUint32(at(register[displayType].totalWeftHundredsHi), at(register[displayType].totalWeftHundredsLo)) : 0;
            const totalWeftCount = totalWeftHundreds * 100;
            const currentDensity = register[displayType].currentDensity ? at(register[displayType].currentDensity) : 0;

            const beamLeft = register[displayType].beamLeft ? at(register[displayType].beamLeft) : 0;

            const alarms = register[displayType].alarms.length ? register[displayType].alarms.map(lw => at(lw)).filter(code => code !== 0) : [];
            let stopsCount = {};
            for (const [key, value] of Object.entries(register[displayType].stopsCount)) {
                const count = value.count ? at(value.count) : 0;
                let duration = value.duration ? at(value.duration) : 0;
                if (["chitic", "pickwell"].includes(displayType)) {
                    duration = duration * 60;
                }
                stopsCount[key] = { count, duration };
            }

            return {
                speedRpm: speedRpm,
                efficiencyPercent: efficiency,
                stop: stopCode,
                loomStateCode: stateCode,
                picksCurrentShift: shiftWeftCount,
                picksTotal: totalWeftCount,
                pieceLengthM: pieceLenMeters,
                beamLeft: beamLeft,
                setPicks: currentDensity,
                alarmsActive: alarms,
                shift: at(register[displayType].shift),
                stopsCount: stopsCount,
                runTime: register[displayType].runTime && typeof at(register[displayType].runTime.hours) === 'number' && typeof at(register[displayType].runTime.minutes) === 'number' ? `${at(register[displayType].runTime.hours).toString().padStart(2, '0')}:${at(register[displayType].runTime.minutes).toString().padStart(2, '0')}` : ''
            };
        } else if (global.config.AIRJET_DISPLAYS.includes(displayType)) {
            let shift = get16(body, register[displayType].shift);
            let runTime = get16(body, register[displayType][shift].runTime);
            let hours = Math.floor(runTime / 60);
            let minutes = runTime % 60;
            let stopsCount = {};
            for (const [key, value] of Object.entries(register[displayType][shift].stopsCount)) {
                const count = value.count ? get16(body, value.count) : 0;
                const duration = (value.duration ? get16(body, value.duration) : 0) * 60;
                stopsCount[key] = { count, duration };
            }
            return {
                speedRpm: get16(body, register[displayType][shift].speedRpm),
                efficiencyPercent: (get16(body, register[displayType][shift].efficiency) || 0) / 10,
                stop: get16(body, register[displayType][shift].stopCode),
                loomStateCode: get16(body, register[displayType][shift].stateCode),
                picksCurrentShift: toUint32(get16(body, register[displayType][shift].shiftWeftCountHi), get16(body, register[displayType][shift].shiftWeftCountLo)),
                pieceLengthM: (toUint32(get16(body, register[displayType][shift].pieceLenHi), get16(body, register[displayType][shift].pieceLenLo))) / 100,
                beamLeft: Math.round(((get16(body, register[displayType][shift].beamLeftLo) << 16) | get16(body, register[displayType][shift].beamLeftHi) || 0) / 100),
                setPicks: (get16(body, register[displayType][shift].currentDensity) || 0) / 100,
                shift: shift,
                stopsCount: stopsCount,
                runTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
            };
        } else if (global.config.DIRECT_DISPLAYS.includes(displayType)) {
            let stopsCount = {};
            for (const [key, value] of Object.entries(register[displayType].stopsCount)) {
                const count = value.count ? get16(body, value.count) : 0;
                const duration = (value.duration ? get16(body, value.duration) : 0) * 60;
                stopsCount[key] = { count, duration };
            }
            let beamCompletionDate = get16(body, register[displayType].beamCompletionDate) || null;
            if(beamCompletionDate) {
                if(displayType == "haiwell") {
                    beamCompletionDate = moment(
                        `${beamCompletionDate} +05:30`,
                        'YYYY-MM-DD HH:mm Z'
                    ).utc();
                } else {
                    beamCompletionDate = moment(beamCompletionDate);
                }
            }
            return {
                speedRpm: get16(body, register[displayType].speedRpm),
                efficiencyPercent: get16(body, register[displayType].efficiencyPercent),
                stop: get16(body, register[displayType].stopCode),
                picksCurrentShift: get16(body, register[displayType].picksCurrentShift),
                pieceLengthM: get16(body, register[displayType].pieceLengthM),
                beamLeft: get16(body, register[displayType].beamLeft),
                beamCompletionDate: beamCompletionDate,
                setPicks: get16(body, register[displayType].currentDensity),
                shift: get16(body, register[displayType].shift),
                stopsCount: stopsCount,
                runTime: get16(body, register[displayType].runTime)
                ? `${Math.floor(get16(body, register[displayType].runTime) / 60)
                    .toString()
                    .padStart(2, '0')}:${Math.floor(get16(body, register[displayType].runTime) % 60)
                    .toString()
                    .padStart(2, '0')}`
                : ''            
            }
        }
    },

    async getMachineLogsWithPagination(options = {}) {
        const page = parseInt(options.page) || 1;
        const limit = parseInt(options.limit) || 100;
        const skip = (page - 1) * limit;
        const status = options.status || 'all'; // all, running, stopped

        let condition = { workspaceId: options.workspaceId, isDeleted: false };
        const machineMap = {};
        let machineIds = [];
        if (options.machineType) {
            const machines = await machineService.find({
                workspaceId: options.workspaceId,
                machineType: options.machineType,
            }, { useLean: true });
            Object.assign(machineMap, machines.reduce((acc, m) => {
                acc[m._id.toString()] = m;
                machineIds.push(m._id);
                return acc;
            }, {}));
            condition.machineId = { $in: machineIds };
        }
        let data = await machineLatestLogsModel.find(condition).sort({ machineId: 1 }).lean(); // .skip(skip).limit(limit).sort({ machineId: 1 }).populate('machineId').lean();
        let efficiency = 0;
        let pick = 0;
        let speed = 0, runningCount = 0;
        let running = 0;
        let stopped = 0;
        for (let machineLog of data) {
            if (machineLog.powerOff === true) {
                machineLog.stop = getPowerOffStopCode();
                machineLog.speedRpm = 0;
            }
            efficiency += machineLog.efficiencyPercent;
            pick += machineLog.picksCurrentShift;
            speed += machineLog.speedRpm;
            runningCount += (machineLog.speedRpm > 0 ? 1 : 0);
            if (machineLog.stop === 0) {
                running++;
            } else {
                stopped++;
            }
        }
        let totalMachines = data.length;
        if (status === 'running') {
            data = data.filter(d => d.stop === 0);
        } else if (status === 'stopped') {
            data = data.filter(d => d.stop !== 0);
        }

        let machineLogs = data.slice(skip, skip + limit);
        if (!options?.machineType) {
            machineIds = [...new Set(machineLogs.map(log => log.machineId))];
            const machines = await machineService.find({ _id: { $in: machineIds } }, { useLean: true });
            Object.assign(machineMap, machines.reduce((acc, m) => {
                acc[m._id.toString()] = m;
                return acc;
            }, {}));
        }
        for (let log of machineLogs) {
            log.machineId = {
                ...machineMap[log.machineId.toString()],
                stopsCount: log.stopsCount,
                lastStartTime: log.lastStartTime,
                lastStopTime: log.lastStopTime,
                stopsData: log.stopsData
            };
        }

        const aggregateReport = {
            efficiency: totalMachines ? Math.round(efficiency / totalMachines) : 0,
            pick: pick,
            avgSpeed: totalMachines ? Math.round(speed / runningCount) : 0,
            avgPicks: totalMachines ? Math.round(pick / totalMachines) : 0,
            running: running,
            stopped: stopped,
            all: running + stopped
        };

        return { data: machineLogs, aggregateReport };
        /*
        let data1 = await machineLogsModel.aggregate([
            // 1) Filter early to use the index
            { $match: { workspaceId: mongoose.Types.ObjectId(options.workspaceId), isDeleted: false } },

            // 2) Rank per machine by createdAt DESC (MongoDB 5.0+)
            {
                $setWindowFields: {
                    partitionBy: "$machineId",
                    sortBy: { createdAt: -1 },
                    output: { rank: { $rank: {} } }
                }
            },

            // Keep only the latest row per machine
            { $match: { rank: 1 } },

            // Avoid shipping heavy fields
            { $project: { rawData: 0, rank: 0 } },

            // 3) Split into data page and counts
            {
                $facet: {
                    data: [
                        { $sort: { createdAt: -1 } }, // overall ordering of latests
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $lookup: {
                                from: "machines",           // <-- collection name for machines
                                localField: "machineId",
                                foreignField: "_id",
                                as: "machine"
                            }
                        },
                        { $unwind: "$machine" },
                        { $sort: { "machine._id": 1}}
                    ],
                    countsRaw: [
                        {
                            $group: {
                                _id: { $cond: [{ $eq: ["$stop", 0] }, "running", "stopped"] },
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                counts: {
                                    $push: { k: "$_id", v: "$count" }
                                },
                                total: { $sum: "$count" }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                counts: { $arrayToObject: "$counts" },
                                total: 1
                            }
                        }
                    ]
                }
            },

            // 4) Flatten counts object for convenience
            {
                $project: {
                    data: 1,
                    counts: {
                        $ifNull: [{ $first: "$countsRaw.counts" }, {}]
                    },
                    totalMachines: { $ifNull: [{ $first: "$countsRaw.total" }, 0] }
                }
            }
         ])

         return data[0];*/
    },

    getStopReason(stopCode, displayType = 'nazon') {
        if (isPowerOffStop(stopCode)) {
            return getPowerOffStopReason();
        }

        let STOP_REASON = {};
        switch(displayType) {
            case 'nazon':
                STOP_REASON = {
                    0: "--", 1: "Warp stop", 2: "Weft stop", 3: "Double weft", 4: "Hand stop", 5: "Full piece",
                    6: "Emergency stop", 7: "Lack weft stop", 8: "Loom error", 9: "Power off (running)",
                    10: "ELOETU error stop", 11: "Weft present on empty cycle", 12: "Weft present on double cycle",
                    13: "Jacquard fix length stop", 14: "Safety barrier stop", 15: "Weft stop area 1",
                    16: "Weft stop area 2", 17: "Weft stop area 3", 18: "Weft stop area 4",
                    19: "Warp stop area 1", 20: "Warp stop area 2"
                };
                break;

            case "chitic":
                STOP_REASON = {
                    0: "--", 1: "Warp stop", 2: "Weft stop", 3: "Double weft", 4: "Hand stop", 5: "Full piece",
                    6: "Emergency stop", 7: "Lack weft stop", 8: "Loom error", 9: "Power off (running)",
                    10: "ELOETU error stop", 11: "Weft present on empty cycle", 12: "Weft present on double cycle",
                    13: "SRDB Fault", 14: "MCB Instruction Err", 15: "Safety barrier stop",
                    16: "Jacquard fix length stop"
                };
                break;

            case "pickwell":
                STOP_REASON = {
                    0: "--", 1: "Warp stop", 2: "Weft stop", 3: "Double weft", 4: "Manual stop", 5: "Full piece",
                    6: "Emergency stop", 7: "Weft feeder lacks yarn", 8: "Loom failure", 9: "Power outage during fast driving",
                    10: "ETU-ELO failure", 11: "Empty weft with weft yarn", 12: "Double weft with broken weft",
                    13: "Driver board alarm", 14: "Main board instruction error", 15: "Safety light curtain action",
                    16: "Jacquard quantitative parking"
                };
                break;
            case "biana":
                STOP_REASON = {
                    0: "--", 1: "Manual stop", 2: "Warp stop", 6: "Storer break stop", 7: "Lack weft stop", 8: "Color 1 short weft stop",
                    9: "Color 2 short weft stop", 10: "Color 3 short weft stop", 11: "Color 4 short weft stop", 12: "Color 1 long weft stop",
                    13: "Color 2 long weft stop", 14: "Color 3 long weft stop", 15: "Color 4 long weft stop"
                };
                break;

            case "haiwell":
                STOP_REASON = {
                    0: "--",
                    1: "Manual stop",
                    2: "Leno-Left stop",
                    3: "Leno-Right stop",
                    4: "Waste stop",
                    5: "EDP stop",
                    6: "Warp stop",
                    10: "Blank holder motor fault",
                    11: "Mechanical folding belt",
                    12: "Abnormal dobby oil level",
                    13: "Abnormal Oil pressurization",
                    14: "Abnormal pressure relief",
                    15: "Dobby pattern preparation",
                    16: "Cashmere meridian stop",
                    17: "Cashmere warp hank yarn",
                    18: "Broken meridians",
                    19: "Abnormal towel pattern",
                    20: "--",
                    21: "Left electronic hinge reset is common",
                    22: "Left electronic hinge reset is unavailable",
                    23: "Right electronic hinge reset is common",
                    24: "Right electronic hinge reset is unavailable",
                    798: "S CAN error",
                    799: "W No response",
                    800: "W CAN error",
                    801: "Loom CAN error",
                    901: "C1H1 weft stop",
                    902: "C1H2 weft stop",
                    903: "C2H1 weft stop",
                    904: "C2H2 weft stop",
                    905: "C3H1 weft stop",
                    906: "C3H2 weft stop",
                    907: "C4H1 weft stop",
                    908: "C4H2 weft stop",
                    909: "C5H1 weft stop",
                    910: "C5H2 weft stop",
                    911: "C6H1 weft stop",
                    912: "C6H2 weft stop",
                    913: "C6H2 weft stop",
                    914: "C7H2 weft stop",
                    915: "C8H1 weft stop",
                    916: "C8H2 weft stop",
                    1000: "Warp Tension:Too Low",
                    1001: "Warp Tension:Too High",
                    1002: "The warp tension is too small",
                    1003: "Warp Tension(U):Too High",
                    1012: "The fuzzing rod does not return to the original point",
                    1036: "loom Low speed1",
                    1037: "loom Turning error1",
                    1038: "loom encoder error 3",
                    1039: "loom encoder error 4",
                    1040: "W No response",
                    1041: "loom encoder error 1",
                    1042: "loom Turning error",
                    1043: "loom Low speed",
                    1100: "Motor overheating",
                    1101: "Brake overheating",
                    1102: "Emergency stop",
                    1103: "Fell-security stop",
                    1104: "ETU-Servo Failure",
                    1105: "ELO-Servo Failure",
                    1106: "ELO-Servo(U) Failure",
                    1107: "Cloth winding servo failure",
                    1108: "Brake released",
                    1109: "Jacquard interlock",
                    1111: "Fuzzing servo failure",
                    1112: "Left leno servo failure",
                    1113: "Right leno servo failure",
                    1200: "Warp servo failure",
                    1201: "Fuzzing servo failure",
                    1202: "Tension servo failure",
                    1203: "The fuzzing rod does not return to the original point",
                    9999: "Power Off"
                };
                break;

            case "picanolRapier":
            case "picanolAirjet":
                STOP_REASON = {
                    0: "--",
                    1: "Warp stop",
                    2: "Weft stop",
                    3: "Filling Break stop",
                    4: "Bobbin Break stop",
                    5: "Mechanical stop",
                    6: "Emergency stop",
                    7: "Emergency Brake stop",
                    8: "Service stop",
                    9: "Other stop",
                    10: "Other stop",
                };
                break;

            case "itema": 
                STOP_REASON = {
                    0: "--",
                    1: "Warp stop",
                    4: "Production end",
                    5: "Manual stop",
                    6: "Technical stop",
                    7: "Cone end stop",
                    10: "Weft anomaly",
                    11: "No gripping",
                    12: "Left gripper",
                    13: "No exchange",
                    14: "Right gripper",
                    15: "Leno stop",
                    16: "Waste selvedge stop"
                };
                break;

        }

        if (displayType === 'itema') {
            const category = stopCode === 0 ? 0 : Math.floor(stopCode / 1000);
            return STOP_REASON[category] || "Other stop";
        }

        return STOP_REASON[stopCode] || "Unknown stop reason";
    }
}