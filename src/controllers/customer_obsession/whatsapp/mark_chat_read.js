const payservedb = require('payservedb');

async function mark_chat_read(request, reply) {
  try {
    const { chat_id } = request.params;
    const decodedChatId = decodeURIComponent(chat_id || '');

    if (!decodedChatId) {
      return reply.code(400).send({ success: false, error: 'chat_id is required' });
    }

    await payservedb.WhatsappConversation.updateMany(
      { chat_id: decodedChatId, direction: 'inbound', is_read: false },
      { $set: { is_read: true } }
    );

    return reply.code(200).send({ success: true, message: 'Chat marked as read' });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to mark chat as read',
      details: error.message
    });
  }
}

module.exports = mark_chat_read;
