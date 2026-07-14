const getMyConversations = require("../controllers/messaging/get_my_conversations");
const startConversation = require("../controllers/messaging/start_conversation");
const makeGetMessages = require("../controllers/messaging/get_messages");
const makeSendMessage = require("../controllers/messaging/send_message");
const { authenticate, requireRole } = require("../middlewares/authenticate");

async function messagingRoutes(fastify) {
  const tenantOpts = { preHandler: [authenticate, requireRole("tenant")] };

  fastify.get("/api/move_in/messaging/conversations", tenantOpts, getMyConversations);
  fastify.post("/api/move_in/messaging/conversations", tenantOpts, startConversation);
  fastify.get("/api/move_in/messaging/conversations/:conversationId/messages", tenantOpts, makeGetMessages("tenant"));
  fastify.post("/api/move_in/messaging/conversations/:conversationId/messages", tenantOpts, makeSendMessage("tenant"));
}

module.exports = messagingRoutes;
