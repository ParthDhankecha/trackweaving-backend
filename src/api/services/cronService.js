const _ = require('lodash');
const moment = require('moment');

const machineLogsService = require("./machineLogsService");
const shiftReportService = require("./shiftReportService");
const notificationService = require("./notificationService");

/** Minute: * (every minute)
 *  Hour: * (every hour)
 *  Day of the month: * (every day)
 *  Month: * (every month)
 *  Day of the week: * (every day of the week)
 */
const CronJob = require('cron').CronJob;
const utilService = require("./utilService");
const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'Asia/Kolkata';


module.exports = {
    async startCronJob() {
        await this.updateNightShiftLogs();
        await this.updateDayShiftLogs();
        await this.sendMorningShiftReports();
        await this.sendEveningShiftReports();
        await this.removeOldNotifications();
    },

    updateNightShiftLogs: async function () {
        var job = new CronJob("0 4 * * *", async function () {
            utilService.log("Starting cron job for night shift logs update...");
            machineLogsService.updateNightShiftLogs();
        }, null, true);
        job.start();
        utilService.log("Cron job scheduled for night shift logs successfully.");
    },

    updateDayShiftLogs: async function () {
        var job = new CronJob("0 15 * * *", async function () {
            utilService.log("Starting cron job for day shift logs update...");
            machineLogsService.updateDayShiftLogs();
        }, null, true);
        job.start();
        utilService.log("Cron job scheduled for day shift logs successfully.");
    },

    sendMorningShiftReports: async function () {
        var job = new CronJob("45 8 * * *", async function () {
            utilService.log("Starting cron job for morning shift report delivery...");
            await shiftReportService.sendNightShiftReports();
        }, null, false, CRON_TIMEZONE);
        job.start();
        utilService.log("Cron job scheduled for morning shift reports at 08:45 successfully.");
    },

    sendEveningShiftReports: async function () {
        var job = new CronJob("45 20 * * *", async function () {
            utilService.log("Starting cron job for evening shift report delivery...");
            await shiftReportService.sendDayShiftReports();
        }, null, false, CRON_TIMEZONE);
        job.start();
        utilService.log("Cron job scheduled for evening shift reports at 20:45 successfully.");
    },

    removeOldNotifications: async function () {
        var job = new CronJob("0 2 * * *", async function () {
            utilService.log("Starting cron job to remove notifications older than 3 months...");
            const cutoffDate = moment().subtract(3, 'months').toDate();
            const result = await notificationService.deleteOlderThan(cutoffDate);
            utilService.log(`Removed ${result.deletedCount} notifications older than 3 months.`);
        }, null, false);
        job.start();
        utilService.log("Cron job scheduled for removing old notifications at 02:00 successfully.");
    }
}