const Conversation = require("../../models/Conversation");
const Message = require("../../models/Message");

// Shared by the tenant and landlord "get messages" routes — `side` is
// 'tenant' or 'landlord' and selects which participant field to match and
// which unread counter to clear on read.
function makeGetMessages(side) {
  return async function getMessages(request, reply) {
    try {
      const { conversationId } = request.params;
      const filter = { _id: conversationId, [`${side}Id`]: request.user.userId };
      const conversation = await Conversation.findOne(filter);
      if (!conversation) return reply.code(404).send({ error: "Conversation not found" });

      const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).lean();

      if (conversation[`${side}Unread`] > 0) {
        conversation[`${side}Unread`] = 0;
        await conversation.save();
      }

      return reply.code(200).send({ success: true, data: messages });
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: err.message });
    }
  };
}

module.exports = makeGetMessages;
