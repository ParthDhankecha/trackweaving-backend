const path = require('path');

const ejs = require('ejs');
const nodemailer = require('nodemailer');
const { errLog, log } = require('./utilService');

module.exports = {
    async send(obj) {
        try {
            if (!global.config.MAIL_AUTH_USER || !global.config.MAIL_AUTH_PASS) {
                errLog('----------Mail Auth User/Pass Empty----------');
                return;
            }
            let transport = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                port: 465,
                secure: false,
                requireTLS: false,
                auth: {
                    user: global.config.MAIL_AUTH_USER,
                    pass: global.config.MAIL_AUTH_PASS
                }
            });

            obj.data.serverUrl = global.config.SERVER_URL;
            obj.data.clientUrl = global.config.CLIENT_URL;
            return;
            obj.html = path.join(__dirname, '../../', `view/emails/${obj.html}/html.ejs`);
            
            log("Mail Sent => "+ obj.to);
            await new Promise(async (resolve, reject) => {
                ejs.renderFile(obj.html, obj.data, async (err, html) => {
                    if (err) {
                        resolve();
                        throw err;
                    }
                    let mailObject = {
                        from: global.config.MAIL_AUTH_USER,
                        to: obj.to,
                        subject: obj.subject || global.config.PROJECT_NAME,
                        html: html
                    };

                    if (obj.data.attachments) {
                        mailObject.attachments = obj.data.attachments;
                    }

                    await transport.sendMail(mailObject);
                    resolve();
                });
            });
        } catch (error) {
            log(error);
        }
    }
};