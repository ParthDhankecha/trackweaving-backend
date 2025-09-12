const { default: mongoose } = require("mongoose");


module.exports = {
    async create(body){
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

    async getMachineLogsWithPagination(options = {}) {
        const page = parseInt(options.page) || 1;
        const limit = parseInt(options.limit) || 10;
        const skip = (page - 1) * limit;
        let data = await machineLogsModel.aggregate([
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
                        { $unwind: "$machine" }
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

         return data[0];
    }
}