const _ = require('lodash');

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
        //every 12 hours
        var job = new CronJob("0 */12 * * *", async function () {
            utilService.log("Cron triggered!");
            // write whatever you perform.
        });
        job.start();
        utilService.log("Cron job scheduled successfully.");
    }
}