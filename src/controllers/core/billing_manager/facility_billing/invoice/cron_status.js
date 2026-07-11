const invoiceGenerator = require("./utils/invoiceGenerator");

const manageCronStatus = async (request, reply) => {
    try {
        const { action, cronExpression } = request.body;

        switch (action) {
            case 'start':
                invoiceGenerator.startCron(cronExpression);
                return reply.code(200).send({
                    message: "Invoice generation cron job started",
                    status: invoiceGenerator.getStatus()
                });

            case 'stop':
                invoiceGenerator.stopCron();
                return reply.code(200).send({
                    message: "Invoice generation cron job stopped",
                    status: invoiceGenerator.getStatus()
                });

            case 'status':
                return reply.code(200).send({
                    message: "Cron job status retrieved",
                    status: invoiceGenerator.getStatus()
                });

            default:
                return reply.code(400).send({
                    error: "Invalid action. Use 'start', 'stop', or 'status'"
                });
        }

    } catch (err) {
        console.error("Error managing cron status:", err);
        return reply.code(500).send({ 
            error: "Failed to manage cron status",
            details: err.message 
        });
    }
};

module.exports = manageCronStatus;
