const { compare } = require('bcrypt');
const utilService = require('./utilService');


module.exports = {

    async create(body) {
        if (body.password) {
            body.password = await utilService.generateHashValue(body.password);
        }
        const doc = new manufacturerModel(body);
        return await doc.save();
    },

    async find(filter = {}, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            skip: undefined,
            limit: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = manufacturerModel.find({ ...filter, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.skip) query.skip(queryOptions.skip);
        if (queryOptions.limit) query.limit(queryOptions.limit);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findOne(filter = {}, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = manufacturerModel.findOne({ ...filter, isDeleted: false });

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async findByIdAndUpdate(_id, data, queryOptions = {}) {
        queryOptions = {
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = manufacturerModel.findByIdAndUpdate({ _id }, data, { new: true });

        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async countDocuments(filter = {}) {
        return await manufacturerModel.countDocuments({ ...filter, isDeleted: false });
    },

    async login(email, plainPassword) {
        const doc = await manufacturerModel.findOne(
            { email: email.toLowerCase().trim(), isDeleted: false, isActive: true },
            '+password'
        ).lean();
        if (!doc) return null;

        const isMatch = await compare(plainPassword, doc.password);
        if (!isMatch) return null;

        const { password, ...result } = doc;
        return result;
    }
};
