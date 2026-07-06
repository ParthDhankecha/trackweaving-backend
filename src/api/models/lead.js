const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const MACHINE_TYPES = ['Rapier Jacquard', 'Rapier', 'Waterjet', 'Airjet', 'Other'];
const LEAD_SOURCES = ['Website', 'Instagram', 'Facebook', 'Reference', 'Direct call', 'WhatsApp', 'Other'];
const LEAD_STATUSES = ['New', 'Contacted', 'Demo scheduled', 'Visited', 'Follow up', 'Converted', 'Not interested', 'Lost'];
const PAYMENT_STATUSES = ['Pending', 'Partial', 'Paid'];

const LeadSchema = new Schema({
    // Basic Details
    customerName: {
        type: String,
        trim: true,
        required: true,
    },
    firmName: {
        type: String,
        trim: true,
        required: true,
    },
    mobileNumber: {
        type: String,
        trim: true,
        required: true,
        index: true,
    },
    alternateMobileNumber: {
        type: String,
        trim: true,
        default: '',
    },
    email: {
        type: String,
        trim: true,
        default: '',
    },
    machineType: {
        type: String,
        enum: MACHINE_TYPES,
        required: true,
        index: true,
    },
    numberOfMachines: {
        type: Number,
        required: true,
        default: 0,
    },
    machineCompany: {
        type: String,
        trim: true,
        default: '',
    },
    machineDisplayCompany: {
        type: String,
        trim: true,
        default: '',
    },
    unitAddress: {
        type: String,
        trim: true,
        default: '',
    },
    unitLocationUrl: {
        type: String,
        trim: true,
        default: '',
    },
    city: {
        type: String,
        trim: true,
        default: '',
    },
    state: {
        type: String,
        trim: true,
        default: '',
    },
    leadSource: {
        type: String,
        enum: [...LEAD_SOURCES, ''],
        default: '',
    },
    remarks: {
        type: String,
        trim: true,
        default: '',
    },

    // Visit Details
    isVisited: {
        type: Boolean,
        default: false,
        index: true,
    },
    visitDate: {
        type: Date,
        default: null,
    },
    visitedBy: {
        type: String,
        trim: true,
        default: '',
    },
    visitRemarks: {
        type: String,
        trim: true,
        default: '',
    },

    // Lead Status
    leadStatus: {
        type: String,
        enum: LEAD_STATUSES,
        default: 'New',
        required: true,
        index: true,
    },

    // Follow Up Details
    nextFollowUpDate: {
        type: Date,
        default: null,
        index: true,
    },
    followUpNotes: {
        type: String,
        trim: true,
        default: '',
    },

    // Conversion Details (relevant when leadStatus === 'Converted')
    isConverted: {
        type: Boolean,
        default: false,
        index: true,
    },
    convertedDate: {
        type: Date,
        default: null,
    },
    numberOfMachinesPurchased: {
        type: Number,
        default: null,
    },
    purchasedMachineCompany: {
        type: String,
        trim: true,
        default: '',
    },
    purchasedMachineType: {
        type: String,
        trim: true,
        default: '',
    },
    pricePerMachine: {
        type: Number,
        default: null,
    },
    totalSetupPrice: {
        type: Number,
        default: null,
    },
    amcPrice: {
        type: Number,
        default: null,
    },
    amcStartDate: {
        type: Date,
        default: null,
    },
    amcEndDate: {
        type: Date,
        default: null,
    },
    paymentStatus: {
        type: String,
        enum: PAYMENT_STATUSES,
        default: 'Pending',
    },
    conversionRemarks: {
        type: String,
        trim: true,
        default: '',
    },

    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false,
        select: false,
    },
}, {
    versionKey: false,
    timestamps: true,
});

// Compound indexes for common query patterns
LeadSchema.index({ firmName: 1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ leadStatus: 1, createdAt: -1 });
LeadSchema.index({ isDeleted: 1, leadStatus: 1 });
LeadSchema.index({ isDeleted: 1, nextFollowUpDate: 1 });

const model = mongoose.model('lead', LeadSchema, 'leads');
module.exports = model;
