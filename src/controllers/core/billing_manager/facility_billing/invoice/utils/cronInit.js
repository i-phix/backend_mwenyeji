const invoiceGenerator = require("./invoiceGenerator");

/**
 * Initialize invoice generation cron job on server startup
 */
function initializeInvoiceCron() {
    try {
        // Start the cron job with default schedule (1st day of every month at midnight)
        // You can modify this expression as needed:
        // '0 0 1 * *' - 1st day of every month at midnight
        // '0 0 * * 1' - Every Monday at midnight
        // '0 9 1 * *' - 1st day of every month at 9 AM
        const cronExpression = process.env.INVOICE_CRON_SCHEDULE || '0 0 1 * *';

        invoiceGenerator.startCron(cronExpression);

        console.log('Invoice generation cron job initialized successfully');
    } catch (error) {
        console.error('Failed to initialize invoice generation cron job:', error);
    }
}

module.exports = {
    initializeInvoiceCron,
    invoiceGenerator
};
