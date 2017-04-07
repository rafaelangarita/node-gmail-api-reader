var cron = require('cron');
var cronJob = cron.job("*/10 * * * * *", function() {
    // perform operation e.g. GET request http.get() etc.
    console.info('cron job completed');
});
cronJob.start();
