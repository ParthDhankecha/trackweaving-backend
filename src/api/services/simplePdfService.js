const fs = require('fs');
const path = require('path');

function escapePdfText(value) {
    return String(value ?? '-')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function truncateText(value, maxLength = 14) {
    const text = String(value ?? '-');
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

class SimplePdfDocument {
    constructor({ title, subtitle, rows, pageWidth = 842, pageHeight = 595, margin = 24 }) {
        this.title = title;
        this.subtitle = subtitle;
        this.rows = rows;
        this.pageWidth = pageWidth;
        this.pageHeight = pageHeight;
        this.margin = margin;
    }

    build() {
        const lines = [];
        let y = this.pageHeight - this.margin - 20;

        lines.push('BT /F1 16 Tf');
        lines.push(`${this.margin} ${y} Td (${escapePdfText(this.title)}) Tj ET`);
        y -= 22;

        lines.push('BT /F2 10 Tf');
        lines.push(`${this.margin} ${y} Td (${escapePdfText(this.subtitle)}) Tj ET`);
        y -= 24;

        const rowHeight = 14;
        const fontSize = 8;
        for (const row of this.rows) {
            if (y < this.margin + rowHeight) {
                break;
            }
            const isHeader = row.bold === true;
            const prefix = isHeader ? '/F2' : '/F1';
            lines.push(`BT ${prefix} ${fontSize} Tf`);
            lines.push(`${this.margin} ${y} Td (${escapePdfText(row.text)}) Tj ET`);
            y -= rowHeight;
        }

        const content = lines.join('\n');
        const objects = [];

        objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
        objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
        objects.push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj`);
        objects.push('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
        objects.push('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj');
        objects.push(`6 0 obj << /Length ${Buffer.byteLength(content, 'utf8')} >> stream\n${content}\nendstream endobj`);

        let pdf = '%PDF-1.4\n';
        const offsets = [0];

        objects.forEach((object) => {
            offsets.push(Buffer.byteLength(pdf, 'utf8'));
            pdf += `${object}\n`;
        });

        const xrefOffset = Buffer.byteLength(pdf, 'utf8');
        pdf += `xref\n0 ${objects.length + 1}\n`;
        pdf += '0000000000 65535 f \n';
        for (let i = 1; i <= objects.length; i++) {
            pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
        }
        pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

        return Buffer.from(pdf, 'utf8');
    }
}

module.exports = {
    SimplePdfDocument,
    escapePdfText,
    truncateText
};
