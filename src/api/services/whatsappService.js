const path = require('path');
const fs = require('fs');
const https = require('https');
const { log, errLog } = require('./utilService');
const moment = require('moment');

function isEnabled() {
    return process.env.WHATSAPP_ENABLED === 'true'
        && process.env.WHATSAPP_ACCESS_TOKEN
        && process.env.WHATSAPP_PHONE_NUMBER_ID;
}

function formatMobileNumber(mobile) {
    if (!mobile) return null;
    const digits = String(mobile).replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    return digits.length >= 10 ? digits : null;
}

function apiRequest({ method, apiPath, headers = {}, body = null }) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v25.0';

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'graph.facebook.com',
            path: `/${apiVersion}/${apiPath}`,
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                ...headers
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    if (res.statusCode >= 400) {
                        reject(new Error(parsed?.error?.message || data || `WhatsApp API error ${res.statusCode}`));
                        return;
                    }
                    resolve(parsed);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function uploadMedia(filePath) {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
    const boundary = `TrackWeaving${Date.now()}`;
    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);

    const preamble = Buffer.from(
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="messaging_product"\r\n\r\n' +
        'whatsapp\r\n' +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        'Content-Type: application/pdf\r\n\r\n'
    );
    const closing = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([preamble, fileContent, closing]);

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'graph.facebook.com',
            path: `/${apiVersion}/${phoneNumberId}/media`,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    if (res.statusCode >= 400) {
                        reject(new Error(parsed?.error?.message || data || `WhatsApp media upload failed ${res.statusCode}`));
                        return;
                    }
                    resolve(parsed.id);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

module.exports = {
    isEnabled,
    formatMobileNumber,

    async sendTextMessage({ mobile, message }) {
        if (!isEnabled()) {
            errLog('WhatsApp is not configured. Skipping text message.');
            return null;
        }

        const to = formatMobileNumber(mobile);
        if (!to) {
            errLog(`Invalid WhatsApp mobile number: ${mobile}`);
            return null;
        }

        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const payload = JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: message }
        });

        const result = await apiRequest({
            method: 'POST',
            apiPath: `${phoneNumberId}/messages`,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            body: payload
        });

        log(`WhatsApp text sent to ${to}`);
        return result;
    },

    async sendDocumentMessage({ mobile, filePath, fileName, workspaceName, shiftLabel, shiftDate, productionMeter, efficiency, realEfficiency, picks, mediaId = null }) {
        if (!isEnabled()) {
            errLog('WhatsApp is not configured. Skipping document message.');
            return null;
        }

        const to = formatMobileNumber(mobile);
        if (!to) {
            errLog(`Invalid WhatsApp mobile number: ${mobile}`);
            return null;
        }

        const resolvedMediaId = mediaId || await uploadMedia(filePath);
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const payload = JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: "shift_production_report_pdf",
                language: {
                    code: "en"
                },
                components: [
                    {
                        type: "header",
                        parameters: [
                            {
                                type: "document",
                                document: {
                                    id: resolvedMediaId,
                                    filename: fileName || path.basename(filePath),
                                }
                            }
                        ]
                    },
                    {
                        type: "body",
                        parameters: [
                            { type: "text", text: workspaceName },
                            { type: "text", text: shiftLabel },
                            { type: "text", text: moment(shiftDate).format('DD MMM YYYY') },
                            { type: "text", text: `${productionMeter} Meters` },
                            { type: "text", text: picks },
                            { type: "text", text: `${efficiency}%` },
                            { type: "text", text: `${realEfficiency}%` },
                        ]
                    }
                ]
            }
        });

        const result = await apiRequest({
            method: 'POST',
            apiPath: `${phoneNumberId}/messages`,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            body: payload
        });

        log(`WhatsApp document sent to ${to}`);
        return result;
    },

    async sendDocumentMessageToMany({ mobiles, filePath, fileName, workspaceName, shiftLabel, shiftDate, productionMeter, efficiency, realEfficiency, picks }) {
        if (!isEnabled()) {
            errLog('WhatsApp is not configured. Skipping document message.');
            return [];
        }

        const recipients = [...new Set(
            (mobiles || [])
                .map(formatMobileNumber)
                .filter(Boolean)
        )];

        if (!recipients.length) {
            errLog('No valid WhatsApp mobile numbers provided.');
            return [];
        }

        const mediaId = await uploadMedia(filePath);
        const messagePayload = {
            filePath,
            fileName,
            workspaceName,
            shiftLabel,
            shiftDate,
            productionMeter,
            efficiency,
            realEfficiency,
            picks,
            mediaId
        };

        const results = await Promise.allSettled(
            recipients.map((mobile) => this.sendDocumentMessage({ mobile, ...messagePayload }))
        );

        return results.map((result, index) => ({
            mobile: recipients[index],
            status: result.status,
            value: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    }
};
