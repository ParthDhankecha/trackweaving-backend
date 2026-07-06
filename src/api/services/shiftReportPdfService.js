'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const REPORTS_DIR = path.join(__dirname, '../../public/upload/shift-reports');

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
    headerBg:   '#212529',
    headerText: '#ffffff',
    subHeadBg:  '#343a40',
    subtotalBg: '#e9ecef',
    grandBg:    '#d1e7dd',
    altBg:      '#f8f9fa',
    rowBg:      '#ffffff',
    border:     '#adb5bd',
    text:       '#212529',
    muted:      '#6c757d',
};

// ─── Page constants ───────────────────────────────────────────────────────────
// A4 landscape: 841.89 × 595.28
const PAGE_W    = 841.89;
const PAGE_H    = 595.28;
const MARGIN    = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;   // 813.89 pt — table fills this exactly

const HDR1_H  = 22;   // group label row
const HDR2_H  = 13;   // Count/Duration sub-row
const ROW_H   = 15;
const FS_HDR  = 6.5;
const FS_DATA = 6.5;

// ─── Fixed column definitions (total = FIXED_W) ───────────────────────────────
const FIXED_COLS = [
    { key: 'date',    label: ['Date'],           w: 52,  align: 'center' },
    { key: 'shift',   label: ['Shift'],          w: 50,  align: 'center' },
    { key: 'machine', label: ['Machine'],        w: 45,  align: 'center' },
    { key: 'prod',    label: ['Prod (Mtrs)'], w: 60,  align: 'right'  },
    { key: 'picks',   label: ['Picks'],          w: 50,  align: 'right'  },
    { key: 'eff',     label: ['Eff %'],          w: 35,  align: 'right'  },
    { key: 'runtime', label: ['Run Time'],    w: 50,  align: 'center' },
    { key: 'beam',    label: ['Beam Left'],   w: 50,  align: 'right'  },
];
const FIXED_W = FIXED_COLS.reduce((s, c) => s + c.w, 0);  // 312

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function fmtDate(d) {
    return d ? moment(d).format('DD MMM YY') : '-';
}

function fmtNum(v, dec = 2) {
    if (v == null || v === '') return '-';
    return Number(v).toFixed(dec);
}

function str(v) {
    return (v != null && v !== '') ? String(v) : '-';
}

/**
 * Draw one table cell: fill background, stroke border, render text.
 */
function cell(doc, x, y, w, h, text, {
    bg       = null,
    color    = C.text,
    fontSize = FS_DATA,
    bold     = false,
    align    = 'center',
    padding  = 2.5,
} = {}) {
    if (bg) {
        doc.save().rect(x, y, w, h).fill(bg).restore();
    }
    doc.save().rect(x, y, w, h).stroke(C.border).restore();

    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .fontSize(fontSize)
       .fillColor(color);

    const lines  = String(text ?? '').split('\n');
    const lineH  = fontSize * 1.4;
    const totalH = lines.length * lineH;
    let   ty     = y + (h - totalH) / 2;

    for (const line of lines) {
        doc.text(line, x + padding, ty, { width: w - padding * 2, align, lineBreak: false });
        ty += lineH;
    }
}

/**
 * Build the full column layout so the total width equals exactly CONTENT_W.
 *
 * Strategy:
 *   remaining = CONTENT_W - FIXED_W
 *   Split remaining among (numStops + 1) pairs where the "Total" pair
 *   gets a 20% bonus over each regular stop pair.
 *
 *   Each pair: cntW = floor(pairW * 0.38), durW = pairW - cntW
 *
 * Returns: { cols, stopPairW, totCntW, totDurW }
 */
function buildCols(stopCols) {
    const remaining = CONTENT_W - FIXED_W;
    const numStops  = stopCols.length;

    // Total pair is 1.2× a regular stop pair
    // N * pairW + 1.2 * pairW = remaining  →  pairW = remaining / (N + 1.2)
    const pairW    = remaining / (numStops + 1.2);
    const totPairW = remaining - numStops * pairW;  // absorbs any rounding

    // Within each regular stop pair
    const cntW = Math.floor(pairW * 0.38);
    const durW = Math.round(pairW - cntW);

    // Within the total pair
    const totCntW = Math.floor(totPairW * 0.38);
    const totDurW = Math.round(totPairW - totCntW);

    const cols = FIXED_COLS.map(c => ({ ...c }));

    for (const sc of stopCols) {
        cols.push({
            key: `stop_${sc.key}_cnt`, stopKey: sc.key, sub: 'count',
            label: [sc.label, 'Count'], w: cntW, align: 'right', isStop: true,
            groupW: cntW + durW, groupLabel: sc.label,
        });
        cols.push({
            key: `stop_${sc.key}_dur`, stopKey: sc.key, sub: 'duration',
            label: [sc.label, 'Duration'], w: durW, align: 'center', isStop: true,
        });
    }

    cols.push({ key: 'tot_cnt', label: ['Total', 'Count'],    w: totCntW, align: 'right',  isTotal: true, groupW: totCntW + totDurW });
    cols.push({ key: 'tot_dur', label: ['Stops', 'Duration'], w: totDurW, align: 'center', isTotal: true });

    return { cols, cntW, durW, totCntW, totDurW, stopPairW: cntW + durW, totPairW };
}

/**
 * Draw the 2-row table header. Returns Y after header.
 */
function drawHeader(doc, x, y, colLayout, stopCols) {
    const { cols, stopPairW, totPairW, cntW, durW, totCntW, totDurW } = colLayout;
    const r1y = y, r2y = y + HDR1_H;
    let cx = x;

    // Row 1: fixed cols span both header rows
    for (const c of FIXED_COLS) {
        cell(doc, cx, r1y, c.w, HDR1_H + HDR2_H, c.label.join('\n'), {
            bg: C.headerBg, color: C.headerText, fontSize: FS_HDR, bold: true, align: 'center',
        });
        cx += c.w;
    }

    // Row 1: stop group labels
    for (const sc of stopCols) {
        cell(doc, cx, r1y, stopPairW, HDR1_H, sc.label, {
            bg: C.headerBg, color: C.headerText, fontSize: FS_HDR, bold: true, align: 'center',
        });
        cx += stopPairW;
    }

    // Row 1: "Total Stops"
    cell(doc, cx, r1y, totPairW, HDR1_H, 'Total Stops', {
        bg: C.headerBg, color: C.headerText, fontSize: FS_HDR, bold: true, align: 'center',
    });

    // Row 2: Count / Duration sub-labels
    cx = x + FIXED_W;
    for (const sc of stopCols) {
        cell(doc, cx,        r2y, cntW, HDR2_H, 'Count',    { bg: C.subHeadBg, color: C.headerText, fontSize: FS_HDR - 0.5, align: 'center' });
        cell(doc, cx + cntW, r2y, durW, HDR2_H, 'Duration', { bg: C.subHeadBg, color: C.headerText, fontSize: FS_HDR - 0.5, align: 'center' });
        cx += stopPairW;
    }
    cell(doc, cx,           r2y, totCntW, HDR2_H, 'Count',    { bg: C.subHeadBg, color: C.headerText, fontSize: FS_HDR - 0.5, align: 'center' });
    cell(doc, cx + totCntW, r2y, totDurW, HDR2_H, 'Duration', { bg: C.subHeadBg, color: C.headerText, fontSize: FS_HDR - 0.5, align: 'center' });

    return r2y + HDR2_H;
}

/**
 * Draw one machine data row. Returns next Y.
 */
function drawDataRow(doc, x, y, machine, item, cols, bg) {
    let cx = x;
    for (const c of cols) {
        let val;
        if      (c.key === 'date')    val = fmtDate(item.reportDate);
        else if (c.key === 'shift')   val = str(item.shiftLabel);
        else if (c.key === 'machine') val = str(machine.machineCode);
        else if (c.key === 'prod')    val = fmtNum(machine.pieceLengthM);
        else if (c.key === 'picks')   val = str(machine.picksCurrentShift);
        else if (c.key === 'eff')     val = fmtNum(machine.efficiencyPercent, 1);
        else if (c.key === 'runtime') val = str(machine.runTime);
        else if (c.key === 'beam')    val = str(machine.beamLeft);
        else if (c.isStop)            val = c.sub === 'count'
            ? str(machine.stopsData?.[c.stopKey]?.count)
            : str(machine.stopsData?.[c.stopKey]?.duration);
        else if (c.key === 'tot_cnt') val = str(machine.stopsData?.total?.count);
        else if (c.key === 'tot_dur') val = str(machine.stopsData?.total?.duration);
        else                          val = '-';

        cell(doc, cx, y, c.w, ROW_H, val, { bg, color: C.text, fontSize: FS_DATA, align: c.align });
        cx += c.w;
    }
    return y + ROW_H;
}

/**
 * Draw a bold subtotal row.
 * Run Time + Beam Left are merged into one cell → "Avg Picks: X".
 * Returns next Y.
 */
function drawSubtotalRow(doc, x, y, item, cols) {
    let cx = x;
    let rtX = null, mergedW = 0;

    for (const c of cols) {
        if (c.key === 'runtime') { rtX = cx; mergedW += c.w; cx += c.w; continue; }
        if (c.key === 'beam')    { mergedW += c.w; cx += c.w; continue; }

        let val = '', align = c.align || 'center';
        if      (c.key === 'date')    val = fmtDate(item.reportDate);
        else if (c.key === 'shift')   { val = str(item.shiftLabel); align = 'left'; }
        else if (c.key === 'machine') val = 'Subtotal';
        else if (c.key === 'prod')    val = fmtNum(item.prodMeter);
        else if (c.key === 'picks')   val = str(item.totalPicks);
        else if (c.key === 'eff')     val = fmtNum(item.efficiency, 1);
        else                          val = '';

        cell(doc, cx, y, c.w, ROW_H, val, { bg: C.subtotalBg, color: C.text, fontSize: FS_DATA, bold: true, align });
        cx += c.w;
    }

    if (rtX !== null) {
        cell(doc, rtX, y, mergedW, ROW_H, `Avg Picks: ${str(item.avgPicks)}`, {
            bg: C.subtotalBg, color: C.text, fontSize: FS_DATA, bold: true, align: 'left',
        });
    }

    return y + ROW_H;
}

/**
 * Draw the grand total row.
 * Run Time + Beam Left are merged → "Avg Picks: X".
 * Returns next Y.
 */
function drawGrandTotalRow(doc, x, y, exportData, cols) {
    let cx = x;
    let rtX = null, mergedW = 0;

    for (const c of cols) {
        if (c.key === 'runtime') { rtX = cx; mergedW += c.w; cx += c.w; continue; }
        if (c.key === 'beam')    { mergedW += c.w; cx += c.w; continue; }

        let val = '', align = c.align || 'center';
        if      (c.key === 'date')  { val = 'TOTAL'; align = 'center'; }
        else if (c.key === 'prod')  val = fmtNum(exportData.avgProdMeter);
        else if (c.key === 'picks') val = str(exportData.totalPicks);
        else if (c.key === 'eff')   val = fmtNum(exportData.totalEfficiency, 1);
        else                        val = '';

        cell(doc, cx, y, c.w, ROW_H, val, { bg: C.grandBg, color: C.text, fontSize: FS_DATA, bold: true, align });
        cx += c.w;
    }

    if (rtX !== null) {
        cell(doc, rtX, y, mergedW, ROW_H, `Avg Picks: ${str(exportData.avgPicks)}`, {
            bg: C.grandBg, color: C.text, fontSize: FS_DATA, bold: true, align: 'left',
        });
    }

    return y + ROW_H;
}

// ─── Main export ──────────────────────────────────────────────────────────────

module.exports = {
    async generateShiftReportPdf({ reportData, firmName, reportDate, shiftLabel }) {
        ensureReportsDir();

        const safeFile  = firmName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName  = `shift-report-${safeFile}-${moment(reportDate).format('YYYYMMDD')}-${shiftLabel.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;
        const filePath  = path.join(REPORTS_DIR, fileName);

        const stopCols  = reportData.stopColumns || [];
        const colLayout = buildCols(stopCols);   // widths computed to fill CONTENT_W exactly
        const { cols }  = colLayout;
        const tableX    = MARGIN;                // always flush to left margin

        return new Promise((resolve, reject) => {
            // size:'A4' + layout:'landscape' → pdfkit uses 841.89 × 595.28
            const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: true });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            let curY = 0;

            // ── Hero header banner ────────────────────────────────────────
            const BANNER_H = 52;
            const ACCENT_H = 4;

            // Dark banner background (full page width)
            doc.save().rect(0, 0, PAGE_W, BANNER_H).fill(C.headerBg).restore();

            // Accent stripe at bottom of banner
            doc.save().rect(0, BANNER_H, PAGE_W, ACCENT_H).fill('#0d6efd').restore();

            // Firm name — large, white, left-aligned with margin
            doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff')
               .text(firmName.toUpperCase(), MARGIN + 6, 10, { lineBreak: false });

            // Report type — right side, smaller
            doc.font('Helvetica').fontSize(8).fillColor('#adb5bd')
               .text('PRODUCTION SHIFT-WISE REPORT', MARGIN + 6, 34, { lineBreak: false });

            // Shift pill — right side
            const pillText  = `  ${shiftLabel}  `;
            const dateText  = `  ${fmtDate(reportDate)}  `;
            const pillW     = 90, pillH = 18, pillX = PAGE_W - MARGIN - pillW * 2 - 8;
            const dateX     = PAGE_W - MARGIN - pillW;

            // Shift pill
            doc.save().roundedRect(pillX, 17, pillW, pillH, 3).fill('#0d6efd').restore();
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
               .text(shiftLabel, pillX, 22, { width: pillW, align: 'center', lineBreak: false });

            // Date pill
            doc.save().roundedRect(dateX, 17, pillW, pillH, 3).fill('#343a40').restore();
            doc.font('Helvetica').fontSize(8).fillColor('#e9ecef')
               .text(fmtDate(reportDate), dateX, 22, { width: pillW, align: 'center', lineBreak: false });

            curY = BANNER_H + ACCENT_H + 6;

            // ── Header helpers ────────────────────────────────────────────
            function printHeader() {
                curY = drawHeader(doc, tableX, curY, colLayout, stopCols);
            }

            function checkBreak(neededH) {
                if (curY + neededH > PAGE_H - MARGIN) {
                    doc.addPage();
                    curY = 0;

                    // Compact continuation banner
                    const MINI_H = 22;
                    doc.save().rect(0, 0, PAGE_W, MINI_H).fill(C.headerBg).restore();
                    doc.save().rect(0, MINI_H, PAGE_W, 3).fill('#0d6efd').restore();
                    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
                       .text(firmName.toUpperCase(), MARGIN + 6, 7, { lineBreak: false });
                    doc.font('Helvetica').fontSize(8).fillColor('#adb5bd')
                       .text(`${shiftLabel}  ·  ${fmtDate(reportDate)}  ·  continued`,
                             0, 7, { width: PAGE_W - MARGIN - 6, align: 'right', lineBreak: false });

                    curY = MINI_H + 3 + 5;
                    printHeader();
                }
            }

            printHeader();

            // ── Data rows ─────────────────────────────────────────────────
            let rowIdx = 0;

            for (const item of reportData.list || []) {
                for (const machine of item.list || []) {
                    checkBreak(ROW_H);
                    const bg = rowIdx % 2 === 0 ? C.altBg : C.rowBg;
                    curY = drawDataRow(doc, tableX, curY, machine, item, cols, bg);
                    rowIdx++;
                }

                checkBreak(ROW_H);
                curY = drawSubtotalRow(doc, tableX, curY, item, cols);
                rowIdx++;

                checkBreak(5);
                curY += 5;
            }

            // ── Grand total ───────────────────────────────────────────────
            checkBreak(ROW_H + 6);
            curY += 6;
            drawGrandTotalRow(doc, tableX, curY, reportData, cols);

            doc.end();
            stream.on('finish', () => resolve({ filePath, fileName }));
            stream.on('error', reject);
        });
    }
};
