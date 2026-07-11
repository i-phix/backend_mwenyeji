const { addFacilityQueue, updateFacilityQueue } = require("./status/change");
const { getFacilityStatus } = require("./status/get_status");
const {
    addEmailToQueue,
    viewEmailQueue,
    deleteEmailFromQueue,
    updateEmailInQueue,
    addSmsToQueue,
    viewSmsQueue,
    deleteSmsFromQueue,
    updateSmsInQueue,
} = require("./add_to_queue/add_email_sms_to_queue");
const {
    releaseEmail,
    releaseEmails,
    releaseAllEmails,
    releaseSms,
    releaseSmsMessages,
    releaseAllSms,
} = require("./release/release");
const toggle_opt = require("./user_opt/toggle_opt");
const get_user_opt = require("./user_opt/get_user_opt");

async function registerRoutes(fastify) {
    const queueBaseRoutes = "/api/emailSmsqueue";

    // Existing facility status routes
    fastify.post(`${queueBaseRoutes}/:facilityId/create`, addFacilityQueue);
    fastify.put(`${queueBaseRoutes}/:facilityId/update`, updateFacilityQueue);
    fastify.get(`${queueBaseRoutes}/:facilityId/status`, getFacilityStatus);

    // Existing email queue routes
    fastify.post(`${queueBaseRoutes}/:facilityId/email`, addEmailToQueue);
    fastify.get(`${queueBaseRoutes}/:facilityId/emails`, viewEmailQueue);
    fastify.put(`${queueBaseRoutes}/:facilityId/email/:id`, updateEmailInQueue);
    fastify.delete(
        `${queueBaseRoutes}/:facilityId/email/:id`,
        deleteEmailFromQueue,
    );

    // Existing SMS queue routes
    fastify.post(`${queueBaseRoutes}/:facilityId/sms`, addSmsToQueue);
    fastify.get(`${queueBaseRoutes}/:facilityId/sms`, viewSmsQueue);
    fastify.put(`${queueBaseRoutes}/:facilityId/sms/:id`, updateSmsInQueue);
    fastify.delete(`${queueBaseRoutes}/:facilityId/sms/:id`, deleteSmsFromQueue);

    // New Release Email Routes
    fastify.post(
        `${queueBaseRoutes}/:facilityId/email/:id/release`,
        releaseEmail,
    );
    fastify.post(`${queueBaseRoutes}/:facilityId/emails/release`, releaseEmails);
    fastify.post(
        `${queueBaseRoutes}/:facilityId/emails/release-all`,
        releaseAllEmails,
    );

    // SMS Release Routes
    fastify.post(`${queueBaseRoutes}/:facilityId/sms/:id/release`, releaseSms);
    fastify.post(
        `${queueBaseRoutes}/:facilityId/sms/release`,
        releaseSmsMessages,
    );
    fastify.post(`${queueBaseRoutes}/:facilityId/sms/release-all`, releaseAllSms);

    // User communication preferences routes
    fastify.get(`${queueBaseRoutes}/:facilityId/user/:userId/opt`, get_user_opt);
    fastify.put(`${queueBaseRoutes}/:facilityId/user/:userId/toggle-opt`, toggle_opt);
}

module.exports = { registerRoutes };