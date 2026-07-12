const Conversation = require("../../models/Conversation");
const Message = require("../../models/Message");
const { notify } = require("../../utils/notify");

// Shared by tenant and landlord "send message" routes. `side` is the
// sender ('tenant'|'landlord'); the other side's unread counter is bumped
// and gets an in-app notification.
function makeSendMessage(side) {
  const otherSide = side === "tenant" ? "landlord" : "tenant";

  return async function sendMessage(request, reply) {
    try {
      const { conversationId } = request.params;
      const { body } = request.body || {};
      if (!body || !body.trim()) return reply.code(400).send({ error: "body is required" });

      const filter = { _id: conversationId, [`${side}Id`]: request.user.userId };
      const conversation = await Conversation.findOne(filter);
      if (!conversation) return reply.code(404).send({ error: "Conversation not found" });

      const message = await new Message({
        conversationId,
        senderType: side,
        senderId: request.user.userId,
        body: body.trim(),
      }).save();

      conversation.lastMessage = message.body;
      conversation.lastMessageAt = message.createdAt;
      conversation[`${otherSide}Unread`] = (conversation[`${otherSide}Unread`] || 0) + 1;
      await conversation.save();

      await notify({
        recipientType: otherSide,
        recipientId: conversation[`${otherSide}Id`],
        type: "message",
        title: "New message",
        body: message.body.slice(0, 140),
        relatedId: conversation._id,
        relatedType: "conversation",
      });

      return reply.code(201).send({ success: true, data: message });
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: err.message });
    }
  };
}

module.exports = makeSendMessage;
