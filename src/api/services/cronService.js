const _ = require('lodash');
const machineLogsService = require("./machineLogsService");

/** Minute: * (every minute)
 *  Hour: * (every hour)
 *  Day of the month: * (every day)
 *  Month: * (every month)
 *  Day of the week: * (every day of the week)
 */
const CronJob = require('cron').CronJob;
const utilService = require("./utilService");


module.exports = {
    async startCronJob() {
        await this.updateNightShiftLogs();
        await this.updateDayShiftLogs();
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
    }
}