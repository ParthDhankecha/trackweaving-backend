const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { ObjectId } = Schema.Types;


const getSubSchema = (subSchema, schemaOptions = {}) => {
    return new Schema(subSchema, { _id: false, ...schemaOptions });
};

// Billing item line
const lineItemSchema = getSubSchema({
    itemDescription: {
        type: String,
        trim: true,
        default: ''
    },
    qty: {
        type: Number,
        default: 0
    },
    unitPrice: {
        type: Number,
        default: 0
    },
    amount: {
        type: Number,
        default: 0
    }
});

// Workspace/party details on the invoice
const workspaceDetailsSchema = getSubSchema({
    firmName: {
        type: String,
        trim: true,
        default: ''
    },
    gst: {
        type: String,
        trim: true,
        default: ''
    },
    mobile: {
        type: String,
        trim: true,
        default: ''
    },
    address: {
        type: String,
        trim: true,
        default: ''
    },
    subscriptionStartDate: {
        type: Date,
        default: null
    },
    subscriptionEndDate: {
        type: Date,
        default: null
    }
});

const paymentSchema = getSubSchema({
    isPaid: {
        type: Boolean,
        default: false
    },
    method: {
        type: String,
        default: ''
    },
    date: {
        type: Date,
        default: null
    },
    reference: {
        type: String,
        default: ''
    },
    notes: {
        type: String,
        default: ''
    }
});

const InvoiceSchema = new Schema({
    invoiceNo: {
        type: Number,
        required: true,
        index: true
    },
    invoiceDate: {
        type: Date,
        default: null
    },
    workspaceId: {
        type: ObjectId,
        ref: 'workspace',
        required: true,
        index: true
    },
    workspace: {
        type: workspaceDetailsSchema,
        default: () => ({})
    },
    lineItems: {
        type: [lineItemSchema],
        default: []
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    discountedTotal: {
        type: Number,
        default: 0
    },
    includesGst: {
        type: Boolean,
        default: false
    },
    taxType: {
        type: String,
        default: ''
    },
    cgstAmount: {
        type: Number,
        default: 0
    },
    sgstAmount: {
        type: Number,
        default: 0
    },
    igstAmount: {
        type: Number,
        default: 0
    },
    inAndAmount: {
        type: Number,
        default: null
    },
    roundOff: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        default: 0
    },
    payment: {
        type: paymentSchema,
        default: () => ({})
    },
    isDeleted: {
        type: Boolean,
        default: false,
        select: false
    }
}, {
    versionKey: false,
    timestamps: true
});

InvoiceSchema.index({ includesGst: 1, invoiceNo: 1 }, { unique: true });

const model = mongoose.model('invoice', InvoiceSchema, 'invoices');
module.exports = model;