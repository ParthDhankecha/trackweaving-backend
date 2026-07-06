const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { SimplePdfDocument, truncateText } = require('./simplePdfService');
const { hasStopKey } = require('./reportService');

const REPORTS_DIR = path.join(__dirname, '../../public/upload/shift-reports');

function ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return moment(dateStr).format('DD MMM YYYY');
}

function num(value, digits = 2) {
    return value != null ? Number(value).toFixed(digits) : '-';
}

function getStopValue(data, key, field) {
    if (!hasStopKey(data?.machineType || 'rapier', key)) {
        return '-';
    }
    return data?.stopsData?.[key]?.[field] ?? '-';
}

function buildMachineRow(data, stopColumns) {
    const parts = [
        truncateText(data.machineCode, 10),
        truncateText(num(data.pieceLengthM), 8),
        truncateText(data.picksCurrentShift, 8),
        truncateText(Math.round(data.efficiencyPercent || 0), 5),
        truncateText(data.runTime || '-', 8),
        truncateText(data.beamLeft, 8)
    ];

    stopColumns.forEach(col => {
        parts.push(truncateText(getStopValue(data, col.key, 'count'), 6));
        parts.push(truncateText(getStopValue(data, col.key, 'duration'), 6));
    });
    parts.push(truncateText(data.stopsData?.total?.count ?? '-', 6));
    parts.push(truncateText(data.stopsData?.total?.duration ?? '-', 8));
    return parts.join(' | ');
}

module.exports = {
    async generateShiftReportPdf({ reportData, firmName, reportDate, shiftLabel }) {
        ensureReportsDir();

        const fileName = `shift-report-${firmName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${moment(reportDate).format('YYYYMMDD')}-${shiftLabel.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;
        const filePath = path.join(REPORTS_DIR, fileName);
        const stopColumns = reportData.stopColumns || [];
        const rows = [];

        rows.push({
            bold: true,
            text: 'Machine | Prod | Picks | Eff | Run | Beam | Stops...'
        });

        for (const item of reportData.list || []) {
            rows.push({ text: `${formatDate(item.reportDate)} - ${item.shiftLabel}` });
            for (const data of item.list || []) {
                rows.push({ text: buildMachineRow(data, stopColumns) });
            }
            rows.push({
                bold: true,
                text: `Subtotal | ${num(item.prodMeter)} | ${item.totalPicks ?? '-'} | ${num(item.efficiency, 1)} | Avg ${item.avgPicks ?? '-'}`
            });
        }

        rows.push({
            bold: true,
            text: `Grand Total | ${num(reportData.avgProdMeter)} | ${reportData.totalPicks ?? '-'} | ${reportData.totalEfficiency ?? '-'} | Avg ${reportData.avgPicks ?? '-'}`
        });

        const pdfBuffer = new SimplePdfDocument({
            title: 'Production Shiftwise Report',
            subtitle: `${firmName} | ${shiftLabel} | ${formatDate(reportDate)}`,
            rows
        }).build();

        fs.writeFileSync(filePath, pdfBuffer);
        return { filePath, fileName };
    }
};
