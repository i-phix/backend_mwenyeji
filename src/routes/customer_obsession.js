const authenticateJWT = require('../middlewares/jwt_authentication');

// Dashboard
const getDashboard = require('../controllers/customer_obsession/dashboard');

// Facility, Units and Customer Controllers
const getFacilities = require('../controllers/customer_obsession/get_facilities');
const getUnits = require('../controllers/customer_obsession/get_units');
const getCustomers = require('../controllers/customer_obsession/get_customers');
const getCustomer = require('../controllers/customer_obsession/get_customer');

// Ticket Controllers
const getTickets = require('../controllers/customer_obsession/tickets/get_tickets');
const getTicket = require('../controllers/customer_obsession/tickets/get_ticket');
const addTicket = require('../controllers/customer_obsession/tickets/add_ticket');
const updateTicket = require('../controllers/customer_obsession/tickets/update_ticket');
const assignTicket = require('../controllers/customer_obsession/tickets/assign_ticket');
const escalateTicket = require('../controllers/customer_obsession/tickets/escalate_ticket');
const deleteTicket = require('../controllers/customer_obsession/tickets/delete_ticket');
const getAuditLogs = require('../controllers/customer_obsession/tickets/get_audit_logs');
const getEmails = require('../controllers/customer_obsession/email/get_emails');
const fetchEmails = require('../controllers/customer_obsession/email/fetch_emails');
const replyEmail = require('../controllers/customer_obsession/email/reply_email');
const linkEmailToTicket = require('../controllers/customer_obsession/email/link_email_to_ticket');
const markEmailRead = require('../controllers/customer_obsession/email/mark_email_read');
const createTicketFromEmail = require('../controllers/customer_obsession/email/create_ticket_from_email');
const getWhatsAppChats = require('../controllers/customer_obsession/whatsapp/get_chats');
const getWhatsAppMessages = require('../controllers/customer_obsession/whatsapp/get_messages');
const sendWhatsAppMessage = require('../controllers/customer_obsession/whatsapp/send_message');
const linkWhatsAppToTicket = require('../controllers/customer_obsession/whatsapp/link_to_ticket');
const createTicketFromWa = require('../controllers/customer_obsession/whatsapp/create_ticket_from_wa');
const markChatRead = require('../controllers/customer_obsession/whatsapp/mark_chat_read');
const syncWhatsAppContacts = require('../controllers/customer_obsession/whatsapp/sync_contacts');
const syncWhatsAppMessages = require('../controllers/customer_obsession/whatsapp/sync_messages');
const addWhatsAppContact = require('../controllers/customer_obsession/whatsapp/add_contact');
const { verify_webhook, receive_webhook } = require('../controllers/customer_obsession/whatsapp/receive_webhook');
const { startGreenNotificationPoller } = require('../controllers/customer_obsession/whatsapp/sync_notifications');

// Knowledge Base Controllers (Agent View)
const getKbArticles = require('../controllers/customer_obsession/knowledge_base/get_articles');
const getKbArticle = require('../controllers/customer_obsession/knowledge_base/get_article');
const searchKbArticles = require('../controllers/customer_obsession/knowledge_base/search_articles');
const rateKbArticle = require('../controllers/customer_obsession/knowledge_base/rate_article');

// Notification Controllers
const getNotifications = require('../controllers/customer_obsession/notifications/get_notifications');
const markAsRead = require('../controllers/customer_obsession/notifications/mark_as_read');
const markAllAsRead = require('../controllers/customer_obsession/notifications/mark_all_as_read');
const checkOverdueTickets = require('../controllers/customer_obsession/notifications/check_overdue_tickets');

// Unit Management Controllers (Read Only)
const getAllUnits = require('../controllers/customer_obsession/units/get_units');
const getUnitDetails = require('../controllers/customer_obsession/units/get_unit');
const getWaterMeter = require('../controllers/customer_obsession/units/get_water_meter');
const getPowerMeter = require('../controllers/customer_obsession/units/get_power_meter');
const getFailedPowerPayments = require('../controllers/customer_obsession/utility_management/power_meter_management/controllers/power_meters/get_failed_payments');
async function registerRoutes(fastify) {
    const jwt = { preHandler: authenticateJWT };
    startGreenNotificationPoller();

    const baseRoute = '/api/customer_obsession';

    // Dashboard Routes
    fastify.get(baseRoute + '/dashboard', jwt, getDashboard);

    // Facility, Units and Customer Routes
    fastify.get(baseRoute + '/facilities', jwt, getFacilities);
    fastify.get(baseRoute + '/facilities/:facilityId/units', jwt, getUnits);
    fastify.get(baseRoute + '/facilities/:facilityId/customers', jwt, getCustomers);
    fastify.get(baseRoute + '/facilities/:facilityId/customers/:customerId', jwt, getCustomer);

    // Ticket Routes
        fastify.get(baseRoute +`/payment-processing/failed`,jwt, getFailedPowerPayments);

    fastify.get(baseRoute + '/tickets', jwt, getTickets);
    fastify.get(baseRoute + '/tickets/:ticket_id', jwt, getTicket);
    fastify.post(baseRoute + '/tickets', jwt, addTicket);
    fastify.put(baseRoute + '/tickets/:ticket_id', jwt, updateTicket);
    fastify.post(baseRoute + '/tickets/:ticket_id/assign', jwt, assignTicket);
    fastify.post(baseRoute + '/tickets/:ticket_id/escalate', jwt, escalateTicket);
    fastify.delete(baseRoute + '/tickets/:ticket_id', jwt, deleteTicket);
    fastify.get(baseRoute + '/tickets/:ticket_id/audit-logs', jwt, getAuditLogs);

    // Email Routes
    fastify.get(baseRoute + '/emails', jwt, getEmails);
    fastify.post(baseRoute + '/emails/fetch', jwt, fetchEmails);
    fastify.post(baseRoute + '/emails/:email_id/reply', jwt, replyEmail);
    fastify.post(baseRoute + '/emails/:email_id/link-ticket', jwt, linkEmailToTicket);
    fastify.post(baseRoute + '/emails/:email_id/create-ticket', jwt, createTicketFromEmail);
    fastify.put(baseRoute + '/emails/:email_id/read', jwt, markEmailRead);

    // WhatsApp Routes
    fastify.get(baseRoute + '/whatsapp/chats', jwt, getWhatsAppChats);
    fastify.get(baseRoute + '/whatsapp/chats/:chat_id/messages', jwt, getWhatsAppMessages);
    fastify.post(baseRoute + '/whatsapp/send', jwt, sendWhatsAppMessage);
    fastify.post(baseRoute + '/whatsapp/link-ticket', jwt, linkWhatsAppToTicket);
    fastify.post(baseRoute + '/whatsapp/create-ticket', jwt, createTicketFromWa);
    fastify.put(baseRoute + '/whatsapp/chats/:chat_id/read', jwt, markChatRead);
    fastify.get(baseRoute + '/whatsapp/contacts/sync', jwt, syncWhatsAppContacts);
    fastify.post(baseRoute + '/whatsapp/sync', jwt, syncWhatsAppMessages);
    fastify.post(baseRoute + '/whatsapp/contacts', jwt, addWhatsAppContact);

    // Public webhook routes (no JWT)
    fastify.get('/api/webhooks/whatsapp', verify_webhook);
    fastify.post('/api/webhooks/whatsapp', receive_webhook);

    // Knowledge Base Routes (Agent Portal - Read Only)
    fastify.get(baseRoute + '/knowledge_base', jwt, getKbArticles);
    fastify.get(baseRoute + '/knowledge_base/articles', jwt, getKbArticles);
    fastify.get(baseRoute + '/knowledge_base/articles/:article_id', jwt, getKbArticle);
    fastify.get(baseRoute + '/knowledge_base/:article_id', jwt, getKbArticle);
    fastify.get(baseRoute + '/knowledge_base/search', jwt, searchKbArticles);
    fastify.post(baseRoute + '/knowledge_base/articles/:article_id/rate', jwt, rateKbArticle);

    // Notification Routes
    fastify.get(baseRoute + '/notifications', jwt, getNotifications);
    fastify.put(baseRoute + '/notifications/:notification_id/read', jwt, markAsRead);
    fastify.put(baseRoute + '/notifications/read-all', jwt, markAllAsRead);
    fastify.post(baseRoute + '/notifications/check-overdue', jwt, checkOverdueTickets);

    // Unit Management Routes (Read Only for Agents)
    fastify.get(baseRoute + '/units', jwt, getAllUnits);
    fastify.get(baseRoute + '/units/:unitId', jwt, getUnitDetails);
    fastify.get(baseRoute + '/units/meter/:facilityId/:unitId', jwt, getWaterMeter);
    fastify.get(baseRoute + '/units/power-meter/:unitId', jwt, getPowerMeter);

    // Agent Routes
    const getAgents = require('../controllers/core/customer_obsession/agents/get_agents');
    const changePassword = require('../controllers/customer_obsession/agents/change_password');
    const getProfile = require('../controllers/customer_obsession/agents/get_profile');
    const upload_profile_image = require('../controllers/customer_obsession/agents/upload_profile_image');

    fastify.get(baseRoute + '/agents', jwt, getAgents);
    fastify.post(baseRoute + '/agents/change-password', jwt, changePassword);
    fastify.get(baseRoute + '/agents/profile', jwt, getProfile);
    fastify.post(baseRoute + '/agents/profile/image', jwt, upload_profile_image);

    // Communication Settings Routes (legacy per-agent auto-reply config)
    const getCommunicationSettings = require('../controllers/customer_obsession/settings/get_communication_settings');
    const updateCommunicationSettings = require('../controllers/customer_obsession/settings/update_communication_settings');
    const autoReplyScheduler = require('../controllers/customer_obsession/notifications/autoReplyScheduler');
    fastify.get(baseRoute + '/settings/communication', jwt, getCommunicationSettings);
    fastify.put(baseRoute + '/settings/communication/:channel', jwt, updateCommunicationSettings);
    fastify.post(baseRoute + '/settings/communication/auto-reply/trigger', jwt, async (request, reply) => {
        try {
            const result = await autoReplyScheduler.runNow();
            return reply.code(200).send({ success: true, data: result });
        } catch (err) {
            return reply.code(500).send({ success: false, error: err.message });
        }
    });

    // PR3: read-only always-CC list for the agent email composer chips
    const getEmailCc = require('../controllers/customer_obsession/settings/get_email_cc');
    fastify.get(baseRoute + '/settings/email-cc', jwt, getEmailCc);

    // PR5: recipient groups for bulk send (agent-side)
    //   Read paths use the agent-specific controllers (channel filter, summary
    //   shape). CRUD + member management reuse the same controllers as the
    //   admin path — they contain no admin-only logic, only attribution via
    //   request.user.userId which works for both COREUSER and AGENTUSER JWTs.
    //   Groups live in a single shared pool so agents and admins see the same
    //   list. The audit trail (created_by / updated_by) records who actually
    //   made each change.
    const listRecipientGroupsAgent = require('../controllers/customer_obsession/recipient_groups/list_groups');
    const getRecipientGroupAgent = require('../controllers/customer_obsession/recipient_groups/get_group');
    const bulkSend = require('../controllers/customer_obsession/recipient_groups/bulk_send');
    const addRecipientGroup = require('../controllers/core/customer_obsession/recipient_groups/add_group');
    const updateRecipientGroup = require('../controllers/core/customer_obsession/recipient_groups/update_group');
    const deleteRecipientGroup = require('../controllers/core/customer_obsession/recipient_groups/delete_group');
    const addRecipientGroupMembers = require('../controllers/core/customer_obsession/recipient_groups/add_members');
    const deleteRecipientGroupMember = require('../controllers/core/customer_obsession/recipient_groups/delete_member');
    const getRecipientGroupsConfig = require('../controllers/core/customer_obsession/recipient_groups/get_config');

    fastify.get(baseRoute + '/recipient-groups/config', jwt, getRecipientGroupsConfig);
    fastify.get(baseRoute + '/recipient-groups', jwt, listRecipientGroupsAgent);
    fastify.get(baseRoute + '/recipient-groups/:id', jwt, getRecipientGroupAgent);
    fastify.post(baseRoute + '/recipient-groups', jwt, addRecipientGroup);
    fastify.put(baseRoute + '/recipient-groups/:id', jwt, updateRecipientGroup);
    fastify.delete(baseRoute + '/recipient-groups/:id', jwt, deleteRecipientGroup);
    fastify.post(baseRoute + '/recipient-groups/:id/members', jwt, addRecipientGroupMembers);
    fastify.delete(baseRoute + '/recipient-groups/:groupId/members/:memberId', jwt, deleteRecipientGroupMember);
    fastify.post(baseRoute + '/bulk-send', jwt, bulkSend);

    // Performance Routes (placeholder for now)
    fastify.get(baseRoute + '/performance/stats', jwt, async (request, reply) => {
        return reply.code(200).send({
            message: "Performance stats endpoint - coming soon"
        });
    });

    // Survey Routes (Public - no JWT required for survey submission)
    const getSurvey = require('../controllers/customer_obsession/surveys/get_survey');
    const submitSurvey = require('../controllers/customer_obsession/surveys/submit_survey');
    const getSurveyAnalytics = require('../controllers/customer_obsession/surveys/get_analytics');

    // Public survey routes (no authentication needed for customers to complete surveys)
    fastify.get('/api/surveys/:token', getSurvey);
    fastify.post('/api/surveys/:token/submit', submitSurvey);

    // Protected analytics route (agents only)
    fastify.get(baseRoute + '/surveys/analytics', jwt, getSurveyAnalytics);


  const getEscalatedMeters = require('../controllers/customer_obsession/utility_management/power_meter_management/controllers/power_meters/get_escalated_meters');
const getFailedWaterPayments = require('../controllers/customer_obsession/utility_management/water_meter_management/controllers/escalated_meters/get_failed_payments');
  const {
    createOrUpdateReadingLimit,
    getReadingLimit,
    deleteReadingLimit,
    getReadingExceededMeters,
    deleteReadingExceededMeter,
    registerReadingExceededMeter,
  } = require('../controllers/customer_obsession/utility_management/water_meter_management/controllers/escalated_meters/reading_limit.controller');

    fastify.get(baseRoute + '/escalated-meters', getEscalatedMeters);
    fastify.get(baseRoute + "/water/payment-processing/failed", getFailedWaterPayments);
    fastify.post(baseRoute + '/reading-limit', createOrUpdateReadingLimit);

    fastify.get(baseRoute + '/reading-limit', getReadingLimit);

    fastify.delete(baseRoute + '/reading-limit', deleteReadingLimit);

    fastify.get(baseRoute + '/reading-exceeded-meters', getReadingExceededMeters);

    fastify.post(baseRoute + '/reading-exceeded-meters', registerReadingExceededMeter);

    fastify.delete(
      baseRoute + '/reading-exceeded-meters/:id',
      deleteReadingExceededMeter
    );


        
}

module.exports = { registerRoutes };
