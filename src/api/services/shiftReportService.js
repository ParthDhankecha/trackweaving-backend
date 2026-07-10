const fs = require('fs');
const moment = require('moment');
const reportService = require('./reportService');
const shiftReportPdfService = require('./shiftReportPdfService');
const whatsappService = require('./whatsappService');
const machineService = require('./machineService');
const workspaceService = require('./workspaceService');
const usersService = require('./usersService');
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
    const reportUsers = await usersService.findV2({
        workspaceId: workspace._id,
        receiveWhatsappReport: true,
        isActive: true,
        isDeleted: false,
        mobile: { $nin: ['', null] }
    }, {
        useLean: true,
        projection: { mobile: 1, fullname: 1, userName: 1 }
    });

    if (!reportUsers.length) {
        log(`Shift report skipped for workspace ${workspace.firmName}: no users with WhatsApp reports enabled.`);
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

    try {
        const sendResults = await whatsappService.sendDocumentMessageToMany({
            mobiles: reportUsers.map(user => user.mobile),
            filePath: pdf.filePath,
            fileName: pdf.fileName,
            workspaceName: workspace.firmName,
            shiftLabel,
            shiftDate: reportDate,
            productionMeter: reportData.avgProdMeter,
            efficiency: reportData.totalEfficiency,
            picks: reportData.totalPicks,
        });

        sendResults.forEach((result, index) => {
            const user = reportUsers[index];
            const userName = user?.fullname || user?.userName || 'User';
            if (result.status === 'fulfilled') {
                log(`Shift report sent to ${result.mobile} (${userName}) for workspace ${workspace.firmName} (${shiftLabel}).`);
                return;
            }
            errLog(`Failed to send shift report to ${result.mobile} (${userName}) for workspace ${workspace.firmName}: ${result.error?.message || 'Unknown error'}`);
            if (result.error) {
                log(result.error);
            }
        });
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
            { useLean: true }
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
