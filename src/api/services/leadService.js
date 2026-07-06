const leadModel = require('../models/lead');
const utilService = require('./utilService');


module.exports = {
    async create(data) {
        const lead = new leadModel(data);
        return await lead.save();
    },

    async exists(filter, options = {}) {
        const { handleDeleted = true } = options;
        return await leadModel.findOne({
            ...(handleDeleted && { isDeleted: false }),
            ...filter,
        }).select({ _id: 1 }).lean();
    },

    async findById(id, options = {}) {
        const { populate, projection, useLean = true, handleDeleted = true } = options;
        const query = leadModel.findOne({
            _id: id,
            ...(handleDeleted && { isDeleted: false }),
        });
        if (populate) query.populate(populate);
        if (projection) query.select(projection);
        if (useLean) query.lean();
        return await query;
    },

    async findOne(filter, options = {}) {
        const { populate, projection, sort, useLean = true, handleDeleted = true } = options;
        const query = leadModel.findOne({
            ...(handleDeleted && { isDeleted: false }),
            ...filter,
        });
        if (populate) query.populate(populate);
        if (projection) query.select(projection);
        if (sort) query.sort(sort);
        if (useLean) query.lean();
        return await query;
    },

    async find(filter, options = {}) {
        const { populate, projection, sort, skip, limit, useLean = true, handleDeleted = true } = options;
        const query = leadModel.find({
            ...(handleDeleted && { isDeleted: false }),
            ...filter,
        });
        if (populate) query.populate(populate);
        if (projection) query.select(projection);
        if (sort) query.sort(sort);
        if (utilService.isNumber(skip, { min: 0 })) query.skip(skip);
        if (utilService.isNumber(limit, { min: 0 })) query.limit(limit);
        if (useLean) query.lean();
        return await query;
    },

    async findByIdAndUpdate(id, data, options = {}) {
        const { populate, projection, useLean = true, returnNew = true, runValidators = true } = options;
        const query = leadModel.findByIdAndUpdate(id, data, { new: returnNew, runValidators });
        if (populate) query.populate(populate);
        if (projection) query.select(projection);
        if (useLean) query.lean();
        return await query;
    },

    async findByIdAndDelete(id, options = {}) {
        const { softDelete = true } = options;
        if (softDelete) {
            const { populate, projection, useLean = true, returnNew = true } = options;
            const query = leadModel.findByIdAndUpdate(id, { isDeleted: true }, { new: returnNew });
            if (populate) query.populate(populate);
            if (projection) query.select(projection);
            if (useLean) query.lean();
            return await query;
        } else {
            return await leadModel.findByIdAndDelete(id);
        }
    },

    async countDocuments(filter, options = {}) {
        const { handleDeleted = true } = options;
        return await leadModel.countDocuments({
            ...(handleDeleted && { isDeleted: false }),
            ...filter,
        });
    },

    aggregate(pipeline) {
        return leadModel.aggregate(pipeline);
    },

    /**
     * Returns CRM summary statistics for the dashboard cards.
     */
    async getStats() {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const [stats] = await leadModel.aggregate([
            { $match: { isDeleted: false } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    newLeads: { $sum: { $cond: [{ $eq: ['$leadStatus', 'New'] }, 1, 0] } },
                    visited: { $sum: { $cond: ['$isVisited', 1, 0] } },
                    converted: { $sum: { $cond: ['$isConverted', 1, 0] } },
                    lost: { $sum: { $cond: [{ $eq: ['$leadStatus', 'Lost'] }, 1, 0] } },
                    totalMachinesConverted: {
                        $sum: {
                            $cond: ['$isConverted', { $ifNull: ['$numberOfMachinesPurchased', 0] }, 0]
                        }
                    },
                    totalConversionValue: {
                        $sum: {
                            $cond: ['$isConverted', { $ifNull: ['$totalSetupPrice', 0] }, 0]
                        }
                    },
                    totalAmcValue: {
                        $sum: {
                            $cond: ['$isConverted', { $ifNull: ['$amcPrice', 0] }, 0]
                        }
                    },
                    followUpsDueToday: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ['$nextFollowUpDate', startOfToday] },
                                        { $lt: ['$nextFollowUpDate', endOfToday] }
                                    ]
                                }, 1, 0
                            ]
                        }
                    },
                    overdueFollowUps: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ['$nextFollowUpDate', null] },
                                        { $lt: ['$nextFollowUpDate', startOfToday] },
                                        { $not: { $in: ['$leadStatus', ['Converted', 'Not interested', 'Lost']] } }
                                    ]
                                }, 1, 0
                            ]
                        }
                    },
                }
            }
        ]);

        return stats || {
            total: 0, newLeads: 0, visited: 0, converted: 0, lost: 0,
            totalMachinesConverted: 0, totalConversionValue: 0, totalAmcValue: 0,
            followUpsDueToday: 0, overdueFollowUps: 0,
        };
    },
};
