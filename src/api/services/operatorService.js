const utilService = require('./utilService');


module.exports = {
    async create(body) {
        const operator = new operatorModel(body);
        return await operator.save();
    },

    async find(options = {}, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            skip: undefined,
            limit: undefined,
            projection: undefined,
            populate: undefined,
            useLean: true,
            ...queryOptions
        };

        const query = operatorModel.find({ ...options, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.skip) query.skip(queryOptions.skip);
        if (queryOptions.limit) query.limit(queryOptions.limit);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findOne(options = {}, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: true,
            ...queryOptions
        };

        const query = operatorModel.findOne({ ...options, isDeleted: false });

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findOneAndUpdate(options = {}, data, queryOptions = {}) {
        queryOptions = {
            new: true,
            projection: undefined,
            populate: undefined,
            useLean: true,
            ...queryOptions
        };

        const query = operatorModel.findOneAndUpdate(
            { ...options, isDeleted: false },
            data,
            { new: queryOptions.new }
        );

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findOneAndDelete(options = {}, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: true,
            ...queryOptions
        };

        const query = operatorModel.findOneAndUpdate(
            { ...options, isDeleted: false },
            { isDeleted: true },
            { new: true }
        );

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async countDocuments(filter = {}) {
        return await operatorModel.countDocuments({ ...filter, isDeleted: false });
    },


    /**
     * @param {number} shift - Shift value to validate
     * @returns {number} Shift value after validation
     */
    validateShift(shift) {
        if (!utilService.isNumber(shift)) {
            throw global.config.message.INVALID_SHIFT;
        }
        const value = Number(shift);
        const allowed = Object.values(global.config.SHIFT_TYPE ?? {});
        if (!Number.isInteger(value) || !allowed.includes(value)) {
            throw global.config.message.INVALID_SHIFT;
        }
        return value;
    },

    /**
     * @param {string} workspaceId
     * @param {string[]} machineIds
     * @param {object} [options]
     * @param {boolean} [options.checkUniqueAssignment=false] - When true, a machine cannot belong to more than one operator on the same shift.
     * @param {number} [options.shift] - Shift to check uniqueness against (required when checkUniqueAssignment is true).
     * @param {string} [options.excludeOperatorId] - Operator to skip (used on update).
     * @param {string[]} [options.alreadyAssigned] - Mutated with machine IDs already assigned to another operator.
     */
    async validateMachineIds(workspaceId, machineIds, options = {}) {
        if (!Array.isArray(machineIds)) {
            throw global.config.message.BAD_REQUEST;
        }

        const uniqueIds = [...new Set(
            machineIds.filter((id) => typeof id === 'string' && utilService.isValidObjectId(id))
        )];
        if (uniqueIds.length !== machineIds.length) {
            throw global.config.message.INVALID_MACHINE_IDS;
        }
        if (!uniqueIds.length) {
            return uniqueIds;
        }

        const machineCount = await machineModel.countDocuments({
            _id: { $in: uniqueIds },
            workspaceId,
            isDeleted: false
        });
        if (machineCount !== uniqueIds.length) {
            throw global.config.message.INVALID_MACHINE_IDS;
        }

        const {
            checkUniqueAssignment = false,
            excludeOperatorId
        } = options;
        if (checkUniqueAssignment) {
            const shift = this.validateShift(options.shift);
            const assignedFilter = {
                workspaceId,
                shift,
                machineIds: { $in: uniqueIds },
                isDeleted: false
            };
            if (excludeOperatorId && utilService.isValidObjectId(excludeOperatorId)) {
                assignedFilter._id = { $ne: excludeOperatorId };
            }

            const assigned = await operatorModel.distinct('machineIds', assignedFilter);
            if (assigned.length > 0) {
                const assignedSet = new Set(assigned.map((id) => String(id)));
                const conflicting = uniqueIds.filter((id) => assignedSet.has(id));
                if (Array.isArray(options.alreadyAssigned)) {
                    options.alreadyAssigned.push(...conflicting);
                }
                throw global.config.message.MACHINE_ALREADY_ASSIGNED_TO_OPERATOR;
            }
        }

        return uniqueIds;
    }
};