const fs = require('fs');
const moment = require('moment');
const reportService = require('./reportService');
const shiftReportPdfService = require('./shiftReportPdfService');
const whatsappService = require('./whatsappService');
const machineService = require('./machineService');
const workspaceService = require('./workspaceService');
const { log, errLog } = require('./utilService');

function getShiftLabel(shiftType) {
    return shiftType === global.config.SHIFT_TYPE.DAY ? 'Day Shift' : 'Night Shift';
}

function getReportDateForShift(shiftType) {
    const now = moment();
    if (shiftType === global.config.SHIFT_TYPE.NIGHT) {
        return now.hour() < 11
            ? now.clone().subtract(1, 'day').startOf('day').toISOString()
            : now.clone().startOf('day').toISOString();
    }
    return now.clone().startOf('day').toISOString();
}

async function sendShiftReportForWorkspace(workspace, shiftType) {
    const owner = workspace.userId;
    if (!owner?.mobile) {
        errLog(`Shift report skipped for workspace ${workspace.firmName}: owner mobile missing.`);
        return;
    }

    const machines = await machineService.find(
        { workspaceId: workspace._id },
        { projection: { _id: 1 }, useLean: true }
    );
    if (!machines.length) {
        log(`Shift report skipped for workspace ${workspace.firmName}: no machines found.`);
        return;
    }

    const reportDate = getReportDateForShift(shiftType);
    const shiftLabel = getShiftLabel(shiftType);
    const machineIds = machines.map(m => m._id);

    const reportData = await reportService.generateProductionShiftWiseReport({
        workspaceId: workspace._id,
        machineIds,
        startDate: reportDate,
        endDate: reportDate,
        shift: [shiftType]
    });

    const exportData = reportService.flattenReportForExport(reportData, shiftType);
    if (!exportData.list.length || !exportData.list.some(item => item.list?.length)) {
        log(`Shift report skipped for workspace ${workspace.firmName}: no report data for ${shiftLabel}.`);
        return;
    }

    const pdf = await shiftReportPdfService.generateShiftReportPdf({
        reportData: exportData,
        firmName: workspace.firmName,
        reportDate,
        shiftLabel
    });

    const ownerName = owner.fullname || owner.userName || 'User';
    const caption = `Hello ${ownerName}, please find attached the ${shiftLabel} Production Report for ${workspace.firmName} dated ${moment(reportDate).format('DD MMM YYYY')}.`;

    try {
        await whatsappService.sendDocumentMessage({
            mobile: owner.mobile,
            filePath: pdf.filePath,
            fileName: pdf.fileName,
            caption
        });
        log(`Shift report sent to ${owner.mobile} for workspace ${workspace.firmName} (${shiftLabel}).`);
    } finally {
        if (fs.existsSync(pdf.filePath)) {
            fs.unlinkSync(pdf.filePath);
        }
    }
}

module.exports = {
    async sendShiftReports(shiftType) {
        const shiftLabel = getShiftLabel(shiftType);
        log(`Starting automatic ${shiftLabel} report job...`);

        if (!whatsappService.isEnabled()) {
            errLog('WhatsApp is not configured. Automatic shift reports will not be sent.');
            return;
        }

        const workspaces = await workspaceService.find(
            { isActive: true },
            {
                populate: { path: 'userId', select: 'mobile fullname userName' },
                useLean: true
            }
        );

        for (const workspace of workspaces) {
            try {
                await sendShiftReportForWorkspace(workspace, shiftType);
            } catch (error) {
                errLog(`Failed to send shift report for workspace ${workspace.firmName}: ${error.message}`);
                log(error);
            }
        }

        log(`Automatic ${shiftLabel} report job completed.`);
    },

    async sendDayShiftReports() {
        return this.sendShiftReports(global.config.SHIFT_TYPE.DAY);
    },

    async sendNightShiftReports() {
        return this.sendShiftReports(global.config.SHIFT_TYPE.NIGHT);
    }
};
