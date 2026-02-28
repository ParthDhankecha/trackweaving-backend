const moment = require('moment');

const invoiceService = require('../../services/invoiceService');
const utilService = require('../../services/utilService');
const workspaceService = require('../../services/workspaceService');



module.exports = {
    getOptions: async (req, res, next) => {
        try {
            const queryObj = {};
            const workspaces = await workspaceService.find(queryObj, {
                projection: { firmName: 1, GSTNo: 1, uid: 1, userId: 1 },
                populate: { path: 'userId', select: 'fullname userName' },
                sort: {
                    isActive: -1, // first active workspaces
                    createdAt: -1, // then recent workspaces
                },
                useLean: true,
            });

            const response = {
                workspaces: workspaces,
            };

            return res.ok(response, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getConfiguration: async (req, res, next) => {
        try {
            const data = {
                todayDate: moment().format('DD-MM-YYYY'),
                panNumber: global.config.PAN_NUMBER || '',
                gstNumber: global.config.GST_NUMBER || '',
                sacCode: global.config.SAC_CODE || '',
                mobile: global.config.INVOICE_PHONE || '',
                address: global.config.INVOICE_ADDRESS || '',
            };

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getById: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['id'], req.params);

            const invoice = await invoiceService.findById(req.params.id, {
                projection: { updatedAt: false }
            });
            if (!invoice) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            return res.ok(invoice, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getList: async (req, res, next) => {
        try {
            const queryObj = {};
            const { page, limit, filter = {} } = req.body;

            const { search, includesGst } = filter;
            if (typeof search === 'string' && search.trim() !== '') {
                const workspaceIds = await workspaceService.distinct('_id', {
                    firmName: { $regex: new RegExp(`${search.trim()}`, 'i') }
                });
                queryObj.workspaceId = { $in: workspaceIds };
            }
            if (typeof includesGst === 'boolean') {
                queryObj.includesGst = includesGst;
            }

            const pageObj = {
                page: parseInt(page, 10) || 1,
                limit: parseInt(limit, 10) || 10,
            };

            const data = {
                count: await invoiceService.countDocuments(queryObj),
                list: [],
            };
            if (data.count > 0) {
                const queryOptions = utilService.getFilter(pageObj);
                queryOptions.sort = { createdAt: -1 };
                queryOptions.useLean = true;
                queryOptions.projection = {
                    invoiceNo: 1,
                    includesGst: 1,
                    'workspace.firmName': 1,
                    'workspace.gst': 1,
                    'workspace.subscriptionStartDate': 1,
                    'workspace.subscriptionEndDate': 1,
                    'finalAmount': 1,
                    'invoiceDate': 1,
                    'payment': 1,
                };

                data.list = await invoiceService.find(queryObj, queryOptions);
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
            utilService.checkRequiredParams([
                'invoiceDate',
                'workspaceId',
                'workspace',
                'lineItems',
                'totalAmount',
                'discountedTotal',
                'discount',
                'finalAmount',
                'includesGst',
                'amcAmount',
            ], body);
            utilService.checkRequiredParams([
                'firmName',
                'gst',
                'mobile',
                'address',
                'subscriptionStartDate',
                'subscriptionEndDate'
            ], body.workspace);

            if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
                throw global.config.message.BAD_REQUEST;
            }
            if (!utilService.isNumber(body.amcAmount, { min: 0 })) {
                throw global.config.message.BAD_REQUEST;
            }

            for (let lineItem of body.lineItems) {
                utilService.checkRequiredParams([
                    'itemDescription',
                    'qty',
                    'unitPrice',
                    'amount'
                ], lineItem);

                if (
                    !utilService.isNumber(lineItem.qty, { min: 0 })
                    || !utilService.isNumber(lineItem.unitPrice, { min: 0 })
                    || !utilService.isNumber(lineItem.amount, { min: 0 })
                ) {
                    throw global.config.message.INVALID_QUANTITY;
                }
            }

            if (!moment(body.invoiceDate).isValid()) {
                throw global.config.message.BAD_REQUEST;
            }

            const workspace = await workspaceService.findOne({
                _id: body.workspaceId
            }, {
                useLean: true,
                projection: { _id: 1 },
            });
            if (!workspace) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            body.invoiceDate = moment(body.invoiceDate).format('YYYY-MM-DD');
            const invoice = await invoiceService.create(body);
            if (!invoice) {
                throw global.config.message.CREATE_FAILED;
            }

            return res.created(null, global.config.message.CREATED);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    update: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['id'], req.params);
            const body = req.body;

            utilService.checkRequiredParams([
                'invoiceDate',
                'workspaceId',
                'workspace',
                'lineItems',
                'totalAmount',
                'discountedTotal',
                'discount',
                'finalAmount',
                'includesGst',
                'amcAmount',
            ], body);
            utilService.checkRequiredParams([
                'firmName',
                'gst',
                'mobile',
                'address',
                'subscriptionStartDate',
                'subscriptionEndDate'
            ], body.workspace);

            if (!utilService.isNumber(body.amcAmount, { min: 0 })) {
                throw global.config.message.BAD_REQUEST;
            }
            if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
                throw global.config.message.BAD_REQUEST;
            }

            for (let lineItem of body.lineItems) {
                utilService.checkRequiredParams([
                    'itemDescription',
                    'qty',
                    'unitPrice',
                    'amount'
                ], lineItem);

                if (
                    !utilService.isNumber(lineItem.qty, { min: 0 })
                    || !utilService.isNumber(lineItem.unitPrice, { min: 0 })
                    || !utilService.isNumber(lineItem.amount, { min: 0 })
                ) {
                    throw global.config.message.INVALID_QUANTITY;
                }
            }
            if (!moment(body.invoiceDate).isValid()) {
                throw global.config.message.BAD_REQUEST;
            }

            const invoice = await invoiceService.findById(req.params.id, { useLean: true });
            if (!invoice) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            if (body.includesGst !== invoice.includesGst) {
                throw global.config.message.INVALID_INVOICE_DETAILS_CHANGE;
            }

            const workspace = await workspaceService.findOne({
                _id: body.workspaceId
            }, {
                useLean: true,
                projection: { _id: 1 },
            });
            if (!workspace) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            const updateData = {
                ...body,
                workspaceId: body.workspaceId,
                workspace: body.workspace,
                lineItems: body.lineItems,
                invoiceDate: moment(body.invoiceDate).format('YYYY-MM-DD'),
            };

            const updatedInvoice = await invoiceService.findByIdAndUpdate(req.params.id, updateData, { useLean: true });
            if (!updatedInvoice) {
                throw global.config.message.NOT_UPDATED;
            }

            return res.ok(updatedInvoice, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    updatePaymentStatus: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['id'], req.params);
            const body = req.body;
            utilService.checkRequiredParams(['isPaid'], body);

            const isPaid = body.isPaid === true;
            const invoiceId = req.params.id;

            const invoice = await invoiceService.findById(invoiceId, { useLean: true });
            if (!invoice) {
                throw global.config.message.RECORD_NOT_FOUND;
            }

            let paymentUpdate;
            if (isPaid) {
                const payment = body.payment;
                if (!payment || typeof payment !== 'object') {
                    throw global.config.message.PAYMENT_INFO_REQUIRED;
                }

                const method = typeof payment.method === 'string' ? payment.method.trim() : '';
                const date = payment.date ? moment(payment.date) : null;
                const reference = typeof payment.reference === 'string' ? payment.reference.trim() : '';
                if (!method || !date || !date.isValid() || !reference) {
                    throw global.config.message.PAYMENT_INFO_REQUIRED;
                }

                paymentUpdate = {
                    isPaid: true,
                    method,
                    date: date.format('YYYY-MM-DD'),
                    reference: reference,
                    notes: typeof payment.notes === 'string' ? payment.notes.trim() : ''
                };
            } else {
                paymentUpdate = {
                    isPaid: false,
                    method: '',
                    date: null,
                    reference: '',
                    notes: ''
                };
            }

            const updatedInvoice = await invoiceService.findByIdAndUpdate(invoiceId, { payment: paymentUpdate }, {
                useLean: true,
                projection: { payment: 1 }
            });
            if (!updatedInvoice) {
                throw global.config.message.NOT_UPDATED;
            }

            return res.ok(updatedInvoice, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    deleteById: async (req, res, next) => {
        try {
            utilService.checkRequiredParams(['id'], req.params);

            const invoice = await invoiceService.findById(req.params.id, {
                projection: { _id: 1 },
                useLean: true,
            });

            if (invoice) {
                const deletedInvoice = await invoiceService.findByIdAndDelete(req.params.id);
                if (!deletedInvoice) {
                    throw global.config.message.NOT_DELETED;
                }
            }

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },
}