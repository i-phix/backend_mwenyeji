const cron = require('node-cron');
const checkOverdueTickets = require('./check_overdue_tickets');
const logger = require('../../../../config/winston');

class OverdueTicketScheduler {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
    }

    /**
     * Start the cron job to check for overdue tickets and auto-escalate
     * Runs every 60 minutes
     * Cron expression: 0 * * * * = every hour
     */
    startCron(cronExpression = '0 * * * *') {
        if (this.cronJob) {
            logger.warn('Overdue ticket checker cron job is already running');
            return;
        }

        try {
            this.cronJob = cron.schedule(cronExpression, async () => {
                if (this.isRunning) {
                    logger.warn('Previous overdue ticket check is still running, skipping this iteration');
                    return;
                }

                this.isRunning = true;
                logger.info('Running scheduled overdue ticket check...');

                try {
                    const result = await checkOverdueTickets();
                    logger.info(`Overdue ticket check completed. Checked: ${result.checked} tickets`);
                } catch (error) {
                    logger.error(`Error in scheduled overdue ticket check: ${error.message}`);
                } finally {
                    this.isRunning = false;
                }
            });

            logger.info(`Overdue ticket checker cron job started with schedule: ${cronExpression}`);
        } catch (error) {
            logger.error(`Failed to start overdue ticket checker cron job: ${error.message}`);
            throw error;
        }
    }

    /**
     * Stop the cron job
     */
    stopCron() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger.info('Overdue ticket checker cron job stopped');
        }
    }

    /**
     * Get the status of the cron job
     */
    getStatus() {
        return {
            isScheduled: this.cronJob !== null,
            isRunning: this.isRunning
        };
    }

    /**
     * Manually trigger a check (for testing or manual runs)
     */
    async runNow() {
        if (this.isRunning) {
            logger.warn('Overdue ticket check is already running');
            return { success: false, message: 'Check is already running' };
        }

        this.isRunning = true;
        try {
            logger.info('Manually triggering overdue ticket check...');
            const result = await checkOverdueTickets();
            logger.info(`Manual overdue ticket check completed. Checked: ${result.checked} tickets`);
            return result;
        } catch (error) {
            logger.error(`Error in manual overdue ticket check: ${error.message}`);
            throw error;
        } finally {
            this.isRunning = false;
        }
    }
}

// Create singleton instance
const overdueTicketScheduler = new OverdueTicketScheduler();

module.exports = overdueTicketScheduler;
