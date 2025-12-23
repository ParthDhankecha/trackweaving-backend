const machineService = require("./machineService");
const notificationService = require("./notificationService");
const { capitalize } = require("lodash");
const moment = require('moment');

const toUint32 = (hi, lo) => (((hi << 16) >>> 0) + (lo >>> 0)) >>> 0;

module.exports = {
    async create(body){
        let machineLog = await machineLatestLogsModel.findOneAndUpdate({machineId: body.machineId}, body, { upsert: true, returnDocument: 'before' });
        let shiftDate;
        if(body.shift == 0) {
            shiftDate = moment(body.updatedTime).startOf('day');
        } else if(body.shift == 1) {
            shiftDate = moment().hour() < 11 ? moment().subtract(1, 'day').startOf('day') : moment().startOf('day');
        }
        if(machineLog) {
            if(machineLog.shift != body.shift) {
                if(body.prevData){
                    await machineLogsModel.findOneAndUpdate({ machineId: body.machineId, workspaceId: body.workspaceId }, body.prevData, { sort: { createdAt: -1 } });
                }
                body.shiftDate = shiftDate;
                body.stopsData = {
                    warp: [],
                    weft: [],
                    feeder: [],
                    manual: [],
                    other: []
                };
                let log = new machineLogsModel(body);
                await log.save();
            } else {
                await machineLogsModel.findOneAndUpdate({ machineId: body.machineId, workspaceId: body.workspaceId, shift: body.shift, shiftDate: shiftDate }, body, { upsert: true });
            }
            this.checkAlertNotification(machineLog, body);
        } else {
            body.shiftDate = shiftDate;
            body.stopsData = {
                warp: [],
                weft: [],
                feeder: [],
                manual: [],
                other: []
            };
            let log = new machineLogsModel(body);
            await log.save();
        }
    },

    async updateNightShiftLogs(){
        let logs = await machineLatestLogsModel.find({ shift: global.config.SHIFT_TYPE.NIGHT }).lean();
        let logIds = [];
        let shiftDate = moment().subtract(1, 'day').startOf('day');
        for(let log of logs) {
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
                other: []
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
        console.log("Night shift logs updated to day shift successfully.");
    },

    async updateDayShiftLogs(){
        let logs = await machineLatestLogsModel.find({ shift: global.config.SHIFT_TYPE.DAY }).lean();
        let logIds = [];
        let shiftDate = moment().startOf('day');
        for(let log of logs) {
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
                other: []
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
    },

    async checkAlertNotification(machineLog, body) {
        let isPickChanged = false;
        let isSpeedAlert = false;

        if(machineLog.setPicks !== body.setPicks) {
            isPickChanged = true;
        }
        if(global.config.MACHINE_ALERT_CONFIG && global.config.MACHINE_ALERT_CONFIG[body.machineId]) {
            if(body.speedRpm > global.config.MACHINE_ALERT_CONFIG[body.machineId].speedLimit) {
                if(!global.config.MACHINE_ALERT_CONFIG[body.machineId].lastSpeedAlertTime || moment().diff(global.config.MACHINE_ALERT_CONFIG[body.machineId].lastSpeedAlertTime, 'minutes') > 10) {
                    if(global.config.MACHINE_ALERT_CONFIG[body.machineId].sendAlert) {
                        isSpeedAlert = true;
                    }
                }
            }
        }
        
        if(isPickChanged || isSpeedAlert) {
            let machine = await machineService.findOne({ _id: body.machineId }, { useLean: true, projection: { machineName: 1, machineCode: 1 } });
            let users = await userModel.find({ workspaceId: body.workspaceId, isActive: true, isDeleted: false }, { _id: 1, fcmToken: 1 }).lean() || [];
            if(users.length) {
                let tokens = [];
                let userIds = [];
                for(let user of users) {
                    if(user.fcmToken) {
                        tokens.push(user.fcmToken);
                    }
                    userIds.push(user._id);
                }
                if(isPickChanged) {
                    let pickNotification = {
                        machineId: body.machineId,
                        workspaceId: body.workspaceId,
                        title: `Picks changed on ${capitalize(machine.machineName)} (${machine.machineCode})`,
                        description: `Picks changed from ${machineLog.setPicks} to ${body.setPicks}`
                    };
                    notificationService.createNotification(pickNotification, userIds, tokens);
                }
                if(isSpeedAlert) {
                    let speedNotification = {
                        machineId: body.machineId,
                        workspaceId: body.workspaceId,
                        title: `Speed alert on ${capitalize(machine.machineName)} (${machine.machineCode})`,
                        description: `Machine speed ${body.speedRpm} RPM exceeded the limit of ${global.config.MACHINE_ALERT_CONFIG[body.machineId].speedLimit} RPM`
                    };
                    notificationService.createNotification(speedNotification, userIds, tokens);
                    global.config.MACHINE_ALERT_CONFIG[body.machineId].lastSpeedAlertTime = moment();
                }
            }
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

    parseBlock(body, displayType = 'nazon') {
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
            }
        };
        const at = (lw) => body[lw - 4999];

        const speedRpm   = register[displayType].speedRpm ? at(register[displayType].speedRpm) : 0;
        const stopCode   = register[displayType].stopCode ? at(register[displayType].stopCode) : 0;
        const stateCode  = register[displayType].stateCode ? at(register[displayType].stateCode) : 0;
        const efficiency = register[displayType].efficiency ? at(register[displayType].efficiency) : 0;

        let pieceLenCm     = register[displayType].pieceLenCm ? at(register[displayType].pieceLenCm) : 0;
        if(displayType == "chitic"){
            pieceLenCm = pieceLenCm / 10;
        }
        const pieceLenMeters = parseFloat((pieceLenCm / 100).toFixed(2));

        const shiftWeftCount = register[displayType].shiftWeftCountHi && register[displayType].shiftWeftCountLo ? toUint32(at(register[displayType].shiftWeftCountHi), at(register[displayType].shiftWeftCountLo)) : 0;
        const totalWeftHundreds = register[displayType].totalWeftHundredsHi && register[displayType].totalWeftHundredsLo ? toUint32(at(register[displayType].totalWeftHundredsHi), at(register[displayType].totalWeftHundredsLo)) : 0;
        const totalWeftCount = totalWeftHundreds * 100;
        const currentDensity = register[displayType].currentDensity ? at(register[displayType].currentDensity) : 0;

        const beamLeft = register[displayType].beamLeft ? at(register[displayType].beamLeft) : 0;

        const alarms = register[displayType].alarms.length ? register[displayType].alarms.map(lw => at(lw)).filter(code => code !== 0) : [];
        let stopsCount = {};
        for (const [key, value] of Object.entries(register[displayType].stopsCount)) {
            const count = value.count ? at(value.count) : 0;
            const duration = value.duration ? at(value.duration) : 0;
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
            runTime: register[displayType].runTime && at(register[displayType].runTime.hours) && at(register[displayType].runTime.minutes) ? `${at(register[displayType].runTime.hours).toString().padStart(2, '0')}:${at(register[displayType].runTime.minutes).toString().padStart(2, '0')}` : ''
        };
    },

    async getMachineLogsWithPagination(options = {}) {
        const page = parseInt(options.page) || 1;
        const limit = parseInt(options.limit) || 10;
        const skip = (page - 1) * limit;
        const status = options.status || 'all'; // all, running, stopped
        let condition = { workspaceId: options.workspaceId, isDeleted: false };
        let data = await machineLatestLogsModel.find(condition).sort({ machineId: 1 }).lean(); // .skip(skip).limit(limit).sort({ machineId: 1 }).populate('machineId').lean();
        let efficiency = 0;
        let pick = 0;
        let speed = 0;
        let running = 0;
        let stopped = 0;
        for(let machineLog of data) {
            efficiency += machineLog.efficiencyPercent;
            pick += machineLog.picksCurrentShift;
            speed += machineLog.speedRpm;
            if(machineLog.stop === 0) {
                running++;
            } else {
                stopped++;
            }
        }
        let totalMachines = data.length;
        if(status === 'running') {
            data = data.filter(d => d.stop === 0);
        } else if(status === 'stopped') {
            data = data.filter(d => d.stop !== 0);
        }
        let machineLogs = data.slice(skip, skip + limit);
        let machineIds = machineLogs.map(log => log.machineId);
        let machines = await machineModel.find({ _id: { $in: machineIds } }).lean();
        for(let log of machineLogs) {
            let machine = machines.find(m => m._id.toString() === log.machineId.toString());
            log.machineId = {
                ...machine,
                stopsCount: log.stopsCount,
                lastStartTime: log.lastStartTime,
                lastStopTime: log.lastStopTime,
                stopsData: log.stopsData
            }
        }
        let aggregateReport = {
            efficiency: totalMachines ? Math.round(efficiency / totalMachines) : 0,
            pick: pick,
            avgSpeed: totalMachines ? Math.round(speed / running) : 0,
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

    getStopReason(stopCode, displayType = 'nazon'){
        let STOP_REASON = {};
        if(displayType == 'nazon') {
            STOP_REASON = {
                0: "--", 1: "Warp stop", 2: "Weft stop", 3: "Double weft", 4: "Hand stop", 5: "Full piece",
                6: "Emergency stop", 7: "Lack weft stop", 8: "Loom error", 9: "Power off (running)",
                10: "ELOETU error stop", 11: "Weft present on empty cycle", 12: "Weft present on double cycle",
                13: "Jacquard fix length stop", 14: "Safety barrier stop", 15: "Weft stop area 1",
                16: "Weft stop area 2", 17: "Weft stop area 3", 18: "Weft stop area 4",
                19: "Warp stop area 1", 20: "Warp stop area 2"
            };
        } else if(displayType == "chitic") {
            STOP_REASON = {
                0: "--", 1: "Warp stop", 2: "Weft stop", 3: "Double weft", 4: "Hand stop", 5: "Full piece",
                6: "Emergency stop", 7: "Lack weft stop", 8: "Loom error", 9: "Power off (running)",
                10: "ELOETU error stop", 11: "Weft present on empty cycle", 12: "Weft present on double cycle",
                13: "SRDB Fault", 14: "MCB Instruction Err", 15: "Safety barrier stop",
                16: "Jacquard fix length stop"
            };
        }
        return STOP_REASON[stopCode] || "Unknown stop reason";
    }
}