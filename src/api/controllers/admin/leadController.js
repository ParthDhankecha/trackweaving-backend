const moment = require('moment');

const leadService = require('../../services/leadService');
const utilService = require('../../services/utilService');


const MACHINE_TYPES = ['Rapier Jacquard', 'Rapier', 'Waterjet', 'Airjet', 'Other'];
const LEAD_SOURCES = ['Website', 'Instagram', 'Facebook', 'Reference', 'Direct call', 'WhatsApp', 'Other', ''];
const LEAD_STATUSES = ['New', 'Contacted', 'Demo scheduled', 'Visited', 'Follow up', 'Converted', 'Not interested', 'Lost'];
const PAYMENT_STATUSES = ['Pending', 'Partial', 'Paid'];


module.exports = {

    getStats: async (req, res, next) => {
        try {
            const stats = await leadService.getStats();
            return res.ok(stats, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getById: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['id'], req.params);

            const lead = await leadService.findById(req.params.id);
            if (!lead) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            return res.ok(lead, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getList: async (req, res, next) => {
        try {
            const { page, limit, filter = {}, sort = {} } = req.body;
            const queryObj = {};

            // Search: customer name, firm name, mobile number
            if (typeof filter.search === 'string' && filter.search.trim() !== '') {
                const regex = new RegExp(filter.search.trim(), 'i');
                queryObj.$or = [
                    { customerName: regex },
                    { firmName: regex },
                    { mobileNumber: regex },
                ];
            }

            // Filter by lead status
            if (typeof filter.leadStatus === 'string' && filter.leadStatus.trim() !== '') {
                queryObj.leadStatus = filter.leadStatus.trim();
            }

            // Filter by machine type
            if (typeof filter.machineType === 'string' && filter.machineType.trim() !== '') {
                queryObj.machineType = filter.machineType.trim();
            }

            // Filter by isVisited
            if (typeof filter.isVisited === 'boolean') {
                queryObj.isVisited = filter.isVisited;
            }

            // Filter by isConverted
            if (typeof filter.isConverted === 'boolean') {
                queryObj.isConverted = filter.isConverted;
            }

            // Filter by visitedBy
            if (typeof filter.visitedBy === 'string' && filter.visitedBy.trim() !== '') {
                queryObj.visitedBy = new RegExp(filter.visitedBy.trim(), 'i');
            }

            // Filter by landmark
            if (typeof filter.landmark === 'string' && filter.landmark.trim() !== '') {
                queryObj.landmark = new RegExp(filter.landmark.trim(), 'i');
            }

            // Date range filter by createdAt
            if (filter.createdAtFrom || filter.createdAtTo) {
                queryObj.createdAt = {};
                if (filter.createdAtFrom) {
                    queryObj.createdAt.$gte = moment(filter.createdAtFrom).startOf('day').toDate();
                }
                if (filter.createdAtTo) {
                    queryObj.createdAt.$lte = moment(filter.createdAtTo).endOf('day').toDate();
                }
            }

            // Follow up due today
            if (filter.followUpDueToday === true) {
                const startOfToday = moment().startOf('day').toDate();
                const endOfToday = moment().endOf('day').toDate();
                queryObj.nextFollowUpDate = { $gte: startOfToday, $lte: endOfToday };
            }

            // Overdue follow ups: nextFollowUpDate in the past, not closed
            if (filter.overdueFollowUp === true) {
                queryObj.nextFollowUpDate = { $ne: null, $lt: moment().startOf('day').toDate() };
                queryObj.leadStatus = { $nin: ['Converted', 'Not interested', 'Lost'] };
            }

            const pageObj = {
                page: parseInt(page, 10) || 1,
                limit: parseInt(limit, 10) || 10,
            };

            const data = {
                count: await leadService.countDocuments(queryObj),
                list: [],
            };

            if (data.count > 0) {
                const queryOptions = utilService.getFilter(pageObj);

                // Sorting
                if (sort.field === 'nextFollowUpDate') {
                    queryOptions.sort = { nextFollowUpDate: sort.order === 'asc' ? 1 : -1 };
                } else if (sort.field === 'numberOfMachines') {
                    queryOptions.sort = { numberOfMachines: sort.order === 'asc' ? 1 : -1 };
                } else {
                    queryOptions.sort = { createdAt: -1 }; // default: latest first
                }

                queryOptions.useLean = true;
                queryOptions.projection = {
                    customerName: 1,
                    firmName: 1,
                    mobileNumber: 1,
                    machineType: 1,
                    numberOfMachines: 1,
                    city: 1,
                    landmark: 1,
                    leadStatus: 1,
                    isVisited: 1,
                    visitedBy: 1,
                    nextFollowUpDate: 1,
                    isConverted: 1,
                    createdAt: 1,
                };

                data.list = await leadService.find(queryObj, queryOptions);
            }

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    create: async (req, res, next) => {
        try {
            const body = req.body;

            // Required field validation
            utilService.checkRequiredParams(['customerName', 'firmName', 'mobileNumber', 'machineType', 'numberOfMachines', 'leadStatus'], body);

            if (!MACHINE_TYPES.includes(body.machineType)) {
                throw global.config.message.BAD_REQUEST;
            }
            if (!LEAD_STATUSES.includes(body.leadStatus)) {
                throw global.config.message.BAD_REQUEST;
            }
            if (!utilService.isNumber(body.numberOfMachines, { min: 1 })) {
                throw global.config.message.BAD_REQUEST;
            }
            if (body.leadSource && !LEAD_SOURCES.includes(body.leadSource)) {
                throw global.config.message.BAD_REQUEST;
            }

            // Visit validation: if isVisited is true, visitDate and visitedBy are required
            if (body.isVisited === true) {
                if (!body.visitDate || !body.visitedBy) {
                    throw global.config.message.BAD_REQUEST;
                }
            }

            // Conversion validation: if status is Converted
            if (body.leadStatus === 'Converted') {
                if (!body.convertedDate || !body.numberOfMachinesPurchased || !body.pricePerMachine || body.amcPrice == null) {
                    throw global.config.message.BAD_REQUEST;
                }
            }

            // Warn on duplicate mobile number - check for existing (non-deleted) lead
            const existing = await leadService.exists({ mobileNumber: body.mobileNumber.trim() });
            if (existing) {
                // Return a warning but don't block creation — frontend decides if user wants to proceed
                // We include a duplicate flag in response
            }

            // Set isConverted based on leadStatus
            body.isConverted = body.leadStatus === 'Converted';

            const lead = await leadService.create(body);
            if (!lead) {
                throw global.config.message.CREATE_FAILED;
            }

            const responseData = { lead, isDuplicate: !!existing };
            return res.created(responseData, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    checkDuplicate: async (req, res, next) => {
        try {
            const { mobileNumber, excludeId } = req.body;
            if (!mobileNumber) {
                throw global.config.message.BAD_REQUEST;
            }

            const filter = { mobileNumber: mobileNumber.trim() };
            if (excludeId) {
                filter._id = { $ne: excludeId };
            }

            const existing = await leadService.exists(filter);
            return res.ok({ isDuplicate: !!existing }, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['id'], req.params);
            const body = req.body;

            utilService.checkRequiredParams(['customerName', 'firmName', 'mobileNumber', 'machineType', 'numberOfMachines', 'leadStatus'], body);

            if (!MACHINE_TYPES.includes(body.machineType)) {
                throw global.config.message.BAD_REQUEST;
            }
            if (!LEAD_STATUSES.includes(body.leadStatus)) {
                throw global.config.message.BAD_REQUEST;
            }
            if (!utilService.isNumber(body.numberOfMachines, { min: 1 })) {
                throw global.config.message.BAD_REQUEST;
            }
            if (body.leadSource && !LEAD_SOURCES.includes(body.leadSource)) {
                throw global.config.message.BAD_REQUEST;
            }

            // Visit validation
            if (body.isVisited === true) {
                if (!body.visitDate || !body.visitedBy) {
                    throw global.config.message.BAD_REQUEST;
                }
            }

            // Conversion validation
            if (body.leadStatus === 'Converted') {
                if (!body.convertedDate || !body.numberOfMachinesPurchased || !body.pricePerMachine || body.amcPrice == null) {
                    throw global.config.message.BAD_REQUEST;
                }
            }

            const lead = await leadService.findById(req.params.id, { useLean: true, projection: { _id: 1 } });
            if (!lead) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            // Sync isConverted with leadStatus
            body.isConverted = body.leadStatus === 'Converted';

            const updatedLead = await leadService.findByIdAndUpdate(req.params.id, body);
            if (!updatedLead) {
                throw global.config.message.NOT_UPDATED;
            }

            return res.ok(updatedLead, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    deleteById: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['id'], req.params);

            const lead = await leadService.findById(req.params.id, {
                projection: { _id: 1 },
                useLean: true,
            });

            if (lead) {
                const deletedLead = await leadService.findByIdAndDelete(req.params.id);
                if (!deletedLead) {
                    throw global.config.message.NOT_DELETED;
                }
            }

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },
};
