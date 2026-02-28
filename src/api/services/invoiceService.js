const utilService = require('./utilService');


module.exports = {
    /**
     * @param {Object} data - The data to create the invoice.
     * @return {Promise<Object>} - The created invoice.
     */
    async create(data) {
        const includesGst = data.includesGst === true;
        const lastInvoice = await invoiceModel.findOne({
            includesGst,
            invoiceNo: { $exists: true, $ne: null }
        }).sort({ invoiceNo: -1 }).select('invoiceNo').lean();

        data.invoiceNo = (lastInvoice && lastInvoice.invoiceNo != null) ? (lastInvoice.invoiceNo + 1) : 1;

        const invoice = new invoiceModel(data);
        return await invoice.save();
    },

    /**
     * @param {Object} filter - The filter criteria to check existence.
     * @param {Object} options - Optional settings for the query execution.
     * @param {boolean} options.handleDeleted - Whether to handle soft-deleted documents. Default is true.
     * @returns {Promise<boolean>} - { _id: ObjectId } if a document exists matching the filter, null otherwise.
     */
    async exists(filter, options = {}) {
        const {
            handleDeleted = true
        } = options;
        return await invoiceModel.findOne({
            ...(handleDeleted && { isDeleted: false }),
            ...filter,
        }).select({ _id: 1 }).lean();
    },

    /**
     * @param {string} id - The ID of the document to find.
     * @param {Object} options - Optional settings for the query execution.
     * @param {Object} options.populate - Populate options to retrieve related data.
     * @param {Object} options.projection - Fields to include or exclude from the result.
     * @param {boolean} options.useLean - Whether to use lean queries for better performance. Default is true.
     * @param {boolean} options.handleDeleted - Whether to handle soft-deleted documents. Default is true.
     * @return {Promise<Object>} - The found document or null if not found or soft-deleted.
     */
    async findById(id, options = {}) {
        const {
            populate,
            projection,
            useLean = true,
            handleDeleted = true
        } = options;

        const query = invoiceModel.findOne({
            _id: id,
            ...(handleDeleted && { isDeleted: false }),
        });

        if (populate) query.populate(populate);
        if (projection) query.select(projection);
        if (useLean) query.lean();

        return await query;
    },

    /** 
     * @param {Object} filter - The filter criteria to find the document.
     * @param {Object} options - Optional settings for the query execution.
     * @param {Object} options.populate - Populate options to retrieve related data.
     * @param {Object} options.projection - Fields to include or exclude from the result.
     * @param {Object} options.sort - Sort order of the results.
     * @param {boolean} options.useLean - Whether to use lean queries for better performance. Default is true.
     * @param {boolean} options.handleDeleted - Whether to handle soft-deleted documents. Default is true.
     * @returns {Promise<Object>} - The found document.
     */
    async findOne(filter, options = {}) {
        const {
            populate,
            projection,
            sort,
            useLean = true,
            handleDeleted = true
        } = options;

        const query = invoiceModel.findOne({
            ...(handleDeleted && { isDeleted: false }),
            ...filter,
        });

        if (populate) query.populate(populate);
        if (projection) query.select(projection);
        if (sort) query.sort(sort);
        if (useLean) query.lean();

        return await query;
    },

    /**
     * @param {Object} filter - The filter criteria to find the documents.
     * @param {Object} options - Optional settings for the query execution.
     * @param {Object} options.populate - Populate options to retrieve related data.
     * @param {Object} options.projection - Fields to include or exclude from the result.
     * @param {Object} options.sort - Sort order of the results.
     * @param {number} options.skip - Number of documents to skip.
     * @param {number} options.limit - Maximum number of documents to return.
     * @param {boolean} options.useLean - Whether to use lean queries for better performance. Default is true.
     * @param {boolean} options.handleDeleted - Whether to handle soft-deleted documents. Default is true.
     * @return {Promise<Array>} - The list of found documents.
     */
    async find(filter, options = {}) {
        const {
            populate,
            projection,
            sort,
            skip,
            limit,
            useLean = true,
            handleDeleted = true
        } = options;

        const query = invoiceModel.find({
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

    /**
     * @param {string} id - The ID of the document to update.
     * @param {Object} data - The data to update the document with.
     * @param {Object} options - Optional settings for the update execution.
     * @param {Object} options.populate - Populate options to retrieve related data.
     * @param {Object} options.projection - Fields to include or exclude from the result.
     * @param {boolean} options.useLean - Whether to use lean queries for better performance. Default is true.
     * @param {boolean} options.returnNew - Whether to return the updated document. Default is true.
     * @param {boolean} options.runValidators - Whether to run validators on the update. Default is true.
     * @return {Promise<Object>} - The updated document.
     */
    async findByIdAndUpdate(id, data, options = {}) {
        const {
            populate,
            projection,
            useLean = true,
            returnNew = true,
            runValidators = true
        } = options;

        const query = invoiceModel.findByIdAndUpdate(id, data, {
            new: returnNew,
            runValidators
        });

        if (populate) query.populate(populate);
        if (projection) query.select(projection);
        if (useLean) query.lean();

        return await query;
    },

    /**
     * @param {Object} filter - The filter criteria to find the document to update.
     * @param {Object} data - The data to update the document with.
     * @param {Object} options - Optional settings for the update execution.
     * @param {Object} options.populate - Populate options to retrieve related data.
     * @param {Object} options.projection - Fields to include or exclude from the result.
     * @param {boolean} options.useLean - Whether to use lean queries for better performance. Default is true.
     * @param {boolean} options.handleDeleted - Whether to handle soft-deleted documents. Default is true.
     * @param {boolean} options.returnNew - Whether to return the updated document. Default is true.
     * @param {boolean} options.runValidators - Whether to run validators on the update. Default is true.
     * @return {Promise<Object>} - The updated document.
     */
    async findOneAndUpdate(filter, data, options = {}) {
        const {
            populate,
            projection,
            useLean = true,
            handleDeleted = true,
            returnNew = true,
            runValidators = true
        } = options;

        const query = invoiceModel.findOneAndUpdate({
            ...(handleDeleted && { isDeleted: false }),
            ...filter,
        }, data, { new: returnNew, runValidators });

        if (populate) query.populate(populate);
        if (projection) query.select(projection);
        if (useLean) query.lean();

        return await query;
    },

    /**
     * @param {string} id - The ID of the document to delete.
     * @param {Object} options - Optional settings for the delete execution.
     * @param {boolean} options.softDelete - Whether to perform a soft delete. Default is true.
     * @param {Object} options.populate - Populate options to retrieve related data.
     * @param {Object} options.projection - Fields to include or exclude from the result.
     * @param {boolean} options.useLean - Whether to use lean queries for better performance. Default is true.
     * @param {boolean} options.returnNew - Whether to return the updated document after soft delete. Default is true.
     * @return {Promise<Object>} - The deleted document or the soft-deleted document.
     */
    async findByIdAndDelete(id, options = {}) {
        const { softDelete = true } = options;
        if (softDelete) {
            const {
                populate,
                projection,
                useLean = true,
                returnNew = true
            } = options;
            const query = invoiceModel.findByIdAndUpdate(id, { isDeleted: true }, { new: returnNew });

            if (populate) query.populate(populate);
            if (projection) query.select(projection);
            if (useLean) query.lean();

            return await query;
        } else {
            return await invoiceModel.findByIdAndDelete(id);
        }
    },

    /**
     * @param {Object} filter - The filter criteria to find the document to delete.
     * @param {Object} options - Optional settings for the delete execution.
     * @param {boolean} options.softDelete - Whether to perform a soft delete. Default is true.
     * @param {Object} options.populate - Populate options to retrieve related data.
     * @param {Object} options.projection - Fields to include or exclude from the result.
     * @param {boolean} options.useLean - Whether to use lean queries for better performance. Default is true.
     * @param {boolean} options.handleDeleted - Whether to handle soft-deleted documents. Default is true.
     * @param {boolean} options.returnNew - Whether to return the updated document after soft delete. Default is true.
     * @return {Promise<Object>} - The deleted document or the soft-deleted document.
     */
    async findOneAndDelete(filter, options = {}) {
        const { softDelete = true } = options;
        if (softDelete) {
            const {
                populate,
                projection,
                useLean = true,
                handleDeleted = true,
                returnNew = true
            } = options;
            const query = invoiceModel.findOneAndUpdate({
                ...(handleDeleted && { isDeleted: false }),
                ...filter,
            }, { isDeleted: true }, { new: returnNew });

            if (populate) query.populate(populate);
            if (projection) query.select(projection);
            if (useLean) query.lean();

            return await query;
        } else {
            return await invoiceModel.findOneAndDelete(filter);
        }
    },

    /**
     * @param {Object} filter - The filter criteria to count the documents.
     * @param {Object} options - Optional settings for the count execution.
     * @param {boolean} options.handleDeleted - Whether to handle soft-deleted documents. Default is true.
     * @return {Promise<number>} - The count of documents matching the filter.
     */
    async countDocuments(filter, options = {}) {
        const { handleDeleted = true } = options;

        return await invoiceModel.countDocuments({
            ...(handleDeleted && { isDeleted: false }),
            ...filter,
        });
    },

    /**
     * @param {Array} pipeline - The aggregation pipeline array.
     * @return {Promise<Array>} - The result of the aggregation.
     */
    aggregate(pipeline) {
        return invoiceModel.aggregate(pipeline);
    },
}