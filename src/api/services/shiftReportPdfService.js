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
    accent:     '#0d6efd',
    beamLow:    '#f89595',
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
const LINE_RATIO = 1.4;

const SUMMARY_GAP = 14;
const SUMMARY_HDR_H = 18;
const SUMMARY_ROW_H = 14;
const SUMMARY_FS = 7;
const MINI_BANNER_H = 22;

const BEAM_COMPLETION_COL = { key: 'beamCompletion', label: ['Beam', 'Completion'], w: 50, align: 'center' };

function getFixedCols(showBeamCompletionDate = false) {
    const cols = [
        { key: 'date',    label: ['Date'],           w: 50,  align: 'center' },
        { key: 'shift',   label: ['Shift'],          w: 30,  align: 'center' },
        { key: 'machine', label: ['Machine'],        w: 42,  align: 'center' },
        { key: 'quality', label: ['Quality'],        w: 76,  align: 'center' },
        { key: 'prod',    label: ['Prod', '(Mtrs)'], w: 35,  align: 'right'  },
        { key: 'picks',   label: ['Picks'],          w: 35,  align: 'right'  },
        { key: 'eff',     label: ['Eff %'],          w: 30,  align: 'right'  },
        { key: 'realEff', label: ['Real', 'Eff %'],  w: 34,  align: 'right'  },
        { key: 'speed',   label: ['Speed'],          w: 34,  align: 'right'  },
        { key: 'runtime', label: ['Run Time'],       w: 40,  align: 'center' },
        { key: 'beam',    label: ['Beam', 'Left'],   w: 30,  align: 'right'  },
    ];
    if (showBeamCompletionDate) cols.push(BEAM_COMPLETION_COL);
    return cols;
}

function normalizeQuality(quality) {
    const value = String(quality ?? '').trim();
    return value || 'Other';
}

function compareQuality(a, b) {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function collectReportMeta(reportData) {
    let showBeamCompletion = false;
    const qualityMap = new Map();

    for (const item of reportData.list || []) {
        for (const machine of item.list || []) {
            if (!showBeamCompletion && machine.beamCompletionDate) showBeamCompletion = true;

            const quality = normalizeQuality(machine.quality);
            const machineCode = String(machine.machineCode ?? '').trim() || '-';
            if (!qualityMap.has(quality)) qualityMap.set(quality, new Map());

            const machines = qualityMap.get(quality);
            const prev = machines.get(machineCode);
            const prod = Number(machine.pieceLengthM) || 0;
            const beam = Number(machine.beamLeft) || 0;
            if (prev) {
                prev.prod += prod;
                prev.beam += beam;
            } else {
                machines.set(machineCode, { prod, beam });
            }
        }
    }

    let grandProd = 0;
    let grandBeam = 0;
    const groups = [...qualityMap.entries()].map(([quality, machineMap]) => {
        let production = 0;
        let beamLeft = 0;
        const machines = [...machineMap.entries()].map(([machine, totals]) => {
            production += totals.prod;
            beamLeft += totals.beam;
            return { machine, production: totals.prod, beamLeft: totals.beam };
        }).sort((a, b) =>
            a.machine.localeCompare(b.machine, undefined, { numeric: true, sensitivity: 'base' })
        );
        grandProd += production;
        grandBeam += beamLeft;
        return { quality, machines, production, beamLeft };
    }).sort((a, b) =>
        compareQuality(a.quality, b.quality)
    );

    return { showBeamCompletion, groups, grandProd, grandBeam };
}

function formatQualityReed(quality, reed) {
    const q = String(quality ?? '').trim();
    const r = String(reed ?? '').trim();
    if (!q && !r) return '-';
    if (!r) return q;
    return q ? `${q} (${r})` : `(${r})`;
}

function ensureReportsDir() {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
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

function breakWord(doc, word, width) {
    const parts = [];
    let chunk = '';
    for (const ch of word) {
        if (chunk && doc.widthOfString(chunk + ch) > width) {
            parts.push(chunk);
            chunk = ch;
        } else {
            chunk += ch;
        }
    }
    if (chunk) parts.push(chunk);
    return parts;
}

function wrapTextToWidth(doc, text, maxWidth, fontSize, bold = false) {
    const value = String(text ?? '');
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    const width = Math.max(maxWidth, 1);
    if (doc.widthOfString(value) <= width) return [value];

    const lines = [];
    for (const para of value.split('\n')) {
        let line = '';
        for (const word of para.split(/\s+/).filter(Boolean)) {
            const next = line ? `${line} ${word}` : word;
            if (doc.widthOfString(next) <= width) {
                line = next;
                continue;
            }
            if (line) lines.push(line);
            if (doc.widthOfString(word) <= width) {
                line = word;
                continue;
            }
            const parts = breakWord(doc, word, width);
            lines.push(...parts.slice(0, -1));
            line = parts[parts.length - 1] || '';
        }
        if (line) lines.push(line);
    }
    return lines.length ? lines : [''];
}

function heightForLines(count, fontSize, minHeight, padding = 2) {
    return Math.max(minHeight, Math.ceil(count * fontSize * LINE_RATIO + padding));
}

function cell(doc, x, y, w, h, text, {
    bg       = null,
    color    = C.text,
    fontSize = FS_DATA,
    bold     = false,
    align    = 'center',
    padding  = 2.5,
    lines    = null,
} = {}) {
    if (bg) doc.rect(x, y, w, h).fillAndStroke(bg, C.border);
    else doc.rect(x, y, w, h).stroke(C.border);

    const maxW = Math.max(w - padding * 2, 1);
    const drawLines = lines || String(text ?? '').split('\n');
    const lineH = fontSize * LINE_RATIO;
    const contentH = fontSize + (drawLines.length - 1) * lineH;
    let ty = y + (h - contentH) / 2;

    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(color);
    for (const line of drawLines) {
        doc.text(line, x + padding, ty, { width: maxW, align, lineBreak: false, ellipsis: true, baseline: 'top' });
        ty += lineH;
    }
}

function buildCols(stopCols, fixedCols) {
    const fixedW = fixedCols.reduce((s, c) => s + c.w, 0);
    const remaining = CONTENT_W - fixedW;
    const numStops  = stopCols.length;

    const pairW    = remaining / (numStops + 1.2);
    const totPairW = remaining - numStops * pairW;
    const cntW = Math.floor(pairW * 0.38);
    const durW = Math.round(pairW - cntW);
    const totCntW = Math.floor(totPairW * 0.38);
    const totDurW = Math.round(totPairW - totCntW);

    const cols = fixedCols.map(c => ({ ...c }));
    for (const sc of stopCols) {
        cols.push({
            key: `stop_${sc.key}_cnt`, stopKey: sc.key, sub: 'count',
            label: [sc.label, 'Count'], w: cntW, align: 'right', isStop: true,
        });
        cols.push({
            key: `stop_${sc.key}_dur`, stopKey: sc.key, sub: 'duration',
            label: [sc.label, 'Duration'], w: durW, align: 'center', isStop: true,
        });
    }
    cols.push({ key: 'tot_cnt', label: ['Total', 'Count'],    w: totCntW, align: 'right',  isTotal: true });
    cols.push({ key: 'tot_dur', label: ['Stops', 'Duration'], w: totDurW, align: 'center', isTotal: true });

    return { cols, cntW, durW, totCntW, totDurW, stopPairW: cntW + durW, totPairW, fixedW };
}

function drawHeader(doc, x, y, colLayout, stopCols, fixedCols) {
    const { stopPairW, totPairW, cntW, durW, totCntW, totDurW, fixedW } = colLayout;
    const r1y = y;
    const r2y = y + HDR1_H;
    const head = { bg: C.headerBg, color: C.headerText, fontSize: FS_HDR, bold: true, align: 'center' };
    const sub = { bg: C.subHeadBg, color: C.headerText, fontSize: FS_HDR - 0.5, align: 'center' };
    let cx = x;

    for (const c of fixedCols) {
        cell(doc, cx, r1y, c.w, HDR1_H + HDR2_H, c.label.join('\n'), head);
        cx += c.w;
    }
    for (const sc of stopCols) {
        cell(doc, cx, r1y, stopPairW, HDR1_H, sc.label, head);
        cx += stopPairW;
    }
    cell(doc, cx, r1y, totPairW, HDR1_H, 'Total Stops', head);

    cx = x + fixedW;
    for (let i = 0; i < stopCols.length; i++) {
        cell(doc, cx,        r2y, cntW, HDR2_H, 'Count', sub);
        cell(doc, cx + cntW, r2y, durW, HDR2_H, 'Duration', sub);
        cx += stopPairW;
    }
    cell(doc, cx,           r2y, totCntW, HDR2_H, 'Count', sub);
    cell(doc, cx + totCntW, r2y, totDurW, HDR2_H, 'Duration', sub);

    return r2y + HDR2_H;
}

function dataCellValue(c, machine, item) {
    switch (c.key) {
        case 'date': return fmtDate(item.reportDate);
        case 'shift': return str(item.shiftLabel);
        case 'machine': return str(machine.machineCode);
        case 'quality': return formatQualityReed(machine.quality, machine.reed);
        case 'prod': return fmtNum(machine.pieceLengthM);
        case 'picks': return str(machine.picksCurrentShift);
        case 'eff': return fmtNum(machine.efficiencyPercent, 1);
        case 'realEff': return fmtNum(machine.realEfficiencyPercent, 1);
        case 'speed': return fmtNum(machine.speedRpm, 0);
        case 'runtime': return str(machine.runTime);
        case 'beam': return str(machine.beamLeft);
        case 'beamCompletion': return fmtDate(machine.beamCompletionDate);
        case 'tot_cnt': return str(machine.stopsData?.total?.count);
        case 'tot_dur': return str(machine.stopsData?.total?.duration);
        default:
            if (c.isStop) {
                return str(machine.stopsData?.[c.stopKey]?.[c.sub === 'count' ? 'count' : 'duration']);
            }
            return '-';
    }
}

function drawDataRow(doc, x, y, machine, item, cols, bg, rowH, qualityLines) {
    let cx = x;
    for (const c of cols) {
        const val = dataCellValue(c, machine, item);
        let rowBg = bg;
        if (c.key === 'beam') {
            const beamValue = Number(machine.beamLeft);
            if (Number.isFinite(beamValue) && beamValue < 1000) rowBg = C.beamLow;
        }
        cell(doc, cx, y, c.w, rowH, val, {
            bg: rowBg,
            color: C.text,
            fontSize: FS_DATA,
            align: c.align,
            lines: c.key === 'quality' ? qualityLines : null,
        });
        cx += c.w;
    }
    return y + rowH;
}

function drawTotalsRow(doc, x, y, cols, { bg, values, avgPicks }) {
    let cx = x;
    let mergeX = null;
    let mergeW = 0;

    for (const c of cols) {
        if (c.key === 'runtime') { mergeX = cx; mergeW += c.w; cx += c.w; continue; }
        if (c.key === 'beam' || c.key === 'beamCompletion') { mergeW += c.w; cx += c.w; continue; }

        const entry = values[c.key] || { val: '', align: c.align || 'center' };
        cell(doc, cx, y, c.w, ROW_H, entry.val, {
            bg, color: C.text, fontSize: FS_DATA, bold: true, align: entry.align,
        });
        cx += c.w;
    }

    if (mergeX !== null) {
        cell(doc, mergeX, y, mergeW, ROW_H, `Avg Picks: ${str(avgPicks)}`, {
            bg, color: C.text, fontSize: FS_DATA, bold: true, align: 'left',
        });
    }
    return y + ROW_H;
}

function getSummaryColWidths(tableW) {
    const qualityW = Math.round(tableW * 0.30);
    const machineW = Math.round(tableW * 0.18);
    const valueW = Math.round(tableW * 0.26);
    return { qualityW, machineW, valueW, totalW: tableW - qualityW - machineW - valueW };
}

function drawSummaryTableHead(doc, x, y, width, widths, title, valueLabel) {
    const { qualityW, machineW, valueW, totalW } = widths;
    cell(doc, x, y, width, SUMMARY_HDR_H, title, {
        bg: C.headerBg, color: C.headerText, fontSize: SUMMARY_FS, bold: true, align: 'center',
    });
    const hy = y + SUMMARY_HDR_H;
    const head = { bg: C.subHeadBg, color: C.headerText, fontSize: SUMMARY_FS, bold: true, align: 'center' };
    cell(doc, x, hy, qualityW, SUMMARY_ROW_H, 'Quality', head);
    cell(doc, x + qualityW, hy, machineW, SUMMARY_ROW_H, 'Machine', head);
    cell(doc, x + qualityW + machineW, hy, valueW, SUMMARY_ROW_H, valueLabel, {...head, align: 'right'});
    cell(doc, x + qualityW + machineW + valueW, hy, totalW, SUMMARY_ROW_H, 'Total', {...head, align: 'right'});
    return hy + SUMMARY_ROW_H;
}

function drawSummaryGroup(doc, x, y, widths, { qualityLines, machines, total, valueKey, groupH, highlightLow }) {
    const { qualityW, machineW, valueW, totalW } = widths;
    const rowH = groupH / machines.length;
    const machineX = x + qualityW;
    const valueX = machineX + machineW;
    const totalX = valueX + valueW;
    const base = { color: C.text, fontSize: SUMMARY_FS, padding: 4 };

    cell(doc, x, y, qualityW, groupH, '', {
        ...base, bg: C.altBg, bold: true, align: 'left', lines: qualityLines,
    });

    const valueFormat = valueKey === 'beamLeft' ? 0 : undefined;
    for (let i = 0; i < machines.length; i++) {
        const row = machines[i];
        const ry = y + i * rowH;
        const rowBg = i % 2 === 0 ? C.rowBg : C.altBg;
        const value = row[valueKey];
        const valueBg = (highlightLow && Number.isFinite(Number(value)) && Number(value) < 1000) ? C.beamLow : rowBg;

        cell(doc, machineX, ry, machineW, rowH, row.machine, { ...base, bg: rowBg, align: 'center' });
        cell(doc, valueX, ry, valueW, rowH, fmtNum(value, valueFormat), { ...base, bg: valueBg, align: 'right' });
    }

    cell(doc, totalX, y, totalW, groupH, fmtNum(total, valueFormat), {
        ...base, bg: C.subtotalBg, bold: true, align: 'right',
    });
    return y + groupH;
}

function drawSummaryGrandTotal(doc, x, y, widths, total, valueKey) {
    const { qualityW, machineW, valueW, totalW } = widths;
    const opts = { bg: C.grandBg, color: C.text, fontSize: SUMMARY_FS, bold: true, padding: 4 };
    cell(doc, x, y, qualityW + machineW + valueW, SUMMARY_ROW_H, 'Total', { ...opts, align: 'left' });
    cell(doc, x + qualityW + machineW + valueW, y, totalW, SUMMARY_ROW_H, fmtNum(total, valueKey === 'beamLeft' ? 0 : undefined), { ...opts, align: 'right' });
}

function drawQualitySummarySection(doc, x, y, groups, grandProd, grandBeam, { onPageBreak } = {}) {
    const tableW = (CONTENT_W - SUMMARY_GAP) / 2;
    const leftX = x;
    const rightX = x + tableW + SUMMARY_GAP;
    const widths = getSummaryColWidths(tableW);
    const pad = 4;
    let cy = y;

    function drawHeads() {
        drawSummaryTableHead(doc, leftX, cy, tableW, widths, 'Quality-wise Production', 'Prod (Mtrs)');
        cy = drawSummaryTableHead(doc, rightX, cy, tableW, widths, 'Quality-wise Beam Left', 'Beam Left');
    }

    function ensureSpace(neededH) {
        if (cy + neededH <= PAGE_H - MARGIN) return;
        if (typeof onPageBreak === 'function') {
            cy = onPageBreak();
            drawHeads();
        }
    }

    drawHeads();

    if (!groups.length) {
        ensureSpace(SUMMARY_ROW_H);
        const empty = { bg: C.altBg, color: C.muted, fontSize: SUMMARY_FS, align: 'center' };
        cell(doc, leftX, cy, tableW, SUMMARY_ROW_H, 'No data', empty);
        cell(doc, rightX, cy, tableW, SUMMARY_ROW_H, 'No data', empty);
        return cy + SUMMARY_ROW_H;
    }

    for (const group of groups) {
        const qualityLines = wrapTextToWidth(doc, group.quality, widths.qualityW - pad * 2, SUMMARY_FS, true);
        const groupH = Math.max(
            group.machines.length * SUMMARY_ROW_H,
            heightForLines(qualityLines.length, SUMMARY_FS, SUMMARY_ROW_H, pad)
        );
        ensureSpace(groupH);

        drawSummaryGroup(doc, leftX, cy, widths, {
            qualityLines, machines: group.machines, total: group.production,
            valueKey: 'production', groupH,
        });
        cy = drawSummaryGroup(doc, rightX, cy, widths, {
            qualityLines, machines: group.machines, total: group.beamLeft,
            valueKey: 'beamLeft', groupH, highlightLow: true,
        });
    }

    ensureSpace(SUMMARY_ROW_H);
    drawSummaryGrandTotal(doc, leftX, cy, widths, grandProd, 'production');
    drawSummaryGrandTotal(doc, rightX, cy, widths, grandBeam, 'beamLeft');
    return cy + SUMMARY_ROW_H;
}

function drawContinuedBanner(doc, firmName, shiftLabel, reportDate) {
    doc.rect(0, 0, PAGE_W, MINI_BANNER_H).fill(C.headerBg);
    doc.rect(0, MINI_BANNER_H, PAGE_W, 3).fill(C.accent);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(
        firmName.toUpperCase(), MARGIN + 6, 7, { lineBreak: false }
    );
    doc.font('Helvetica').fontSize(8).fillColor('#adb5bd').text(
        `${shiftLabel}  ·  ${fmtDate(reportDate)}  ·  continued`, 0, 7, { width: PAGE_W - MARGIN - 6, align: 'right', lineBreak: false }
    );
    return MINI_BANNER_H + 8;
}

// ─── Main export ──────────────────────────────────────────────────────────────

module.exports = {
    async generateShiftReportPdf({ reportData, firmName, reportDate, shiftLabel }) {
        ensureReportsDir();

        const safeFile  = firmName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName  = `shift-report-${safeFile}-${moment(reportDate).format('YYYYMMDD')}-${shiftLabel.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;
        const filePath  = path.join(REPORTS_DIR, fileName);

        const { showBeamCompletion, groups, grandProd, grandBeam } = collectReportMeta(reportData);
        const stopCols = reportData.stopColumns || [];
        const fixedCols = getFixedCols(showBeamCompletion);
        const colLayout = buildCols(stopCols, fixedCols);
        const { cols } = colLayout;
        const qualityCol = cols.find(c => c.key === 'quality');
        const qualityPad = 2.5;
        const tableX = MARGIN;

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: true });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            const BANNER_H = 52;
            const ACCENT_H = 4;
            const pillW = 90;
            const pillH = 18;
            const pillX = PAGE_W - MARGIN - pillW * 2 - 8;
            const dateX = PAGE_W - MARGIN - pillW;

            doc.rect(0, 0, PAGE_W, BANNER_H).fill(C.headerBg);
            doc.rect(0, BANNER_H, PAGE_W, ACCENT_H).fill(C.accent);
            doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff')
                .text(firmName.toUpperCase(), MARGIN + 6, 10, { lineBreak: false });
            doc.font('Helvetica').fontSize(8).fillColor('#adb5bd')
                .text('PRODUCTION SHIFT-WISE REPORT', MARGIN + 6, 34, { lineBreak: false });
            doc.roundedRect(pillX, 17, pillW, pillH, 3).fill(C.accent);
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
                .text(shiftLabel, pillX, 22, { width: pillW, align: 'center', lineBreak: false });
            doc.roundedRect(dateX, 17, pillW, pillH, 3).fill('#343a40');
            doc.font('Helvetica').fontSize(8).fillColor('#e9ecef')
                .text(fmtDate(reportDate), dateX, 22, { width: pillW, align: 'center', lineBreak: false });

            let curY = BANNER_H + ACCENT_H + 6;

            function printHeader() {
                curY = drawHeader(doc, tableX, curY, colLayout, stopCols, fixedCols);
            }

            function startContinuedPage() {
                doc.addPage();
                curY = drawContinuedBanner(doc, firmName, shiftLabel, reportDate);
            }

            function checkBreak(neededH) {
                if (curY + neededH <= PAGE_H - MARGIN) return;
                startContinuedPage();
                printHeader();
            }

            printHeader();

            // ── Data rows ─────────────────────────────────────────────────
            let rowIdx = 0;
            for (const item of reportData.list || []) {
                for (const machine of item.list || []) {
                    const qualityText = formatQualityReed(machine.quality, machine.reed);
                    const qualityLines = qualityCol
                        ? wrapTextToWidth(doc, qualityText, qualityCol.w - qualityPad * 2, FS_DATA)
                        : [qualityText];
                    const rowH = heightForLines(qualityLines.length, FS_DATA, ROW_H, qualityPad);
                    checkBreak(rowH);
                    const bg = rowIdx % 2 === 0 ? C.altBg : C.rowBg;
                    curY = drawDataRow(doc, tableX, curY, machine, item, cols, bg, rowH, qualityLines);
                    rowIdx++;
                }

                checkBreak(ROW_H);
                curY = drawTotalsRow(doc, tableX, curY, cols, {
                    bg: C.subtotalBg,
                    avgPicks: item.avgPicks,
                    values: {
                        date: { val: fmtDate(item.reportDate), align: 'center' },
                        shift: { val: str(item.shiftLabel), align: 'left' },
                        machine: { val: 'Subtotal', align: 'center' },
                        prod: { val: fmtNum(item.prodMeter), align: 'right' },
                        picks: { val: str(item.totalPicks), align: 'right' },
                        eff: { val: fmtNum(item.efficiency, 1), align: 'right' },
                        realEff: { val: fmtNum(item.realEfficiency, 1), align: 'right' },
                        speed: { val: fmtNum(item.avgSpeed, 0), align: 'right' },
                    },
                });
                rowIdx++;

                checkBreak(5);
                curY += 5;
            }

            checkBreak(ROW_H + 6);
            curY += 6;
            curY = drawTotalsRow(doc, tableX, curY, cols, {
                bg: C.grandBg,
                avgPicks: reportData.avgPicks,
                values: {
                    date: { val: 'TOTAL', align: 'center' },
                    prod: { val: fmtNum(reportData.avgProdMeter), align: 'right' },
                    picks: { val: str(reportData.totalPicks), align: 'right' },
                    eff: { val: fmtNum(reportData.totalEfficiency, 1), align: 'right' },
                    realEff: { val: fmtNum(reportData.totalRealEfficiency, 1), align: 'right' },
                    speed: { val: fmtNum(reportData.avgSpeed, 0), align: 'right' },
                },
            });
            curY += 10;

            if (curY + SUMMARY_HDR_H + SUMMARY_ROW_H * 3 > PAGE_H - MARGIN) {
                startContinuedPage();
            }

            drawQualitySummarySection(doc, tableX, curY, groups, grandProd, grandBeam, {
                onPageBreak: () => {
                    startContinuedPage();
                    return curY;
                },
            });

            doc.end();
            stream.on('finish', () => resolve({ filePath, fileName }));
            stream.on('error', reject);
        });
    }
};
