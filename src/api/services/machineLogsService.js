const toUint32 = (hi, lo) => (((hi << 16) >>> 0) + (lo >>> 0)) >>> 0;

module.exports = {
    async create(body){
        await machineLatestLogsModel.findOneAndUpdate({machineId: body.machineId}, body, { upsert: true, new: true });
        const machineLogs = new machineLogsModel(body);
        return await machineLogs.save();
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

    parseBlock(body) {
        const buf = body.rawData.words;
        const at = (lw) => buf[lw - body.rawData.start];

        const speedRpm   = at(5010);
        const stopCode   = at(5027);
        const stateCode  = at(5028);
        const efficiency = at(5017);

        const pieceLenCm     = at(5013);
        const pieceLenMeters = pieceLenCm / 100;

        const shiftWeftCount = toUint32(at(5016), at(5015));
        const totalWeftHundreds = toUint32(at(5020), at(5019));
        const totalWeftCount = totalWeftHundreds * 100;
        const currentDensity = at(5035);

        const beam1Remain = at(5023);

        const alarms = [at(5029), at(5030), at(5031), at(5032)];

        return {
            ...body,
            speedRpm: speedRpm,
            efficiencyPercent: efficiency,
            stop: stopCode,
            loomStateCode: stateCode,
            picksCurrentShift: shiftWeftCount,
            picksTotal: totalWeftCount,
            pieceLengthM: pieceLenMeters,
            beamLeft: beam1Remain,
            setPicks: currentDensity,
            alarmsActive: alarms,
            runTime: `${buf[56].toString().padStart(2, '0')}:${buf[57].toString().padStart(2, '0')}`
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
        if(status === 'running') {
            data = data.filter(d => d.stop === 0);
        } else if(status === 'stopped') {
            data = data.filter(d => d.stop !== 0);
        }
        let machineLogs = data.slice(skip, skip + limit);
        let machineIds = machineLogs.map(log => log.machineId);
        let machines = await machineModel.find({ _id: { $in: machineIds } }).lean();
        for(let log of machineLogs) {
            log.machineId = machines.find(m => m._id.toString() === log.machineId.toString());
        }
        let aggregateReport = {
            efficiency: data.length ? Math.round(efficiency / data.length) : 0,
            pick: pick,
            avgSpeed: data.length ? Math.round(speed / data.length) : 0,
            avgPicks: data.length ? Math.round(pick / data.length) : 0,
            running: running,
            stopped: stopped,
            all: data.length
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

    getStopReason(stopCode){
        const STOP_REASON = {
            0: "--", 1: "Warp stop", 2: "Weft stop", 3: "Double weft", 4: "Hand stop", 5: "Full piece",
            6: "Emergency stop", 7: "Lack weft stop", 8: "Loom error", 9: "Power off (running)",
            10: "ELOETU error stop", 11: "Weft present on empty cycle", 12: "Weft present on double cycle",
            13: "Jacquard fix length stop", 14: "Safety barrier stop", 15: "Weft stop area 1",
            16: "Weft stop area 2", 17: "Weft stop area 3", 18: "Weft stop area 4",
            19: "Warp stop area 1", 20: "Warp stop area 2"
        };

        return STOP_REASON[stopCode] || "Unknown stop reason";
    }
}