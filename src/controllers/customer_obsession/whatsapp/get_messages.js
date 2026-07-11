const payservedb = require('payservedb');

async function get_messages(request, reply) {
  try {
    const { chat_id } = request.params;
    const { page = 1, limit = 50 } = request.query;

    const decodedChatId = decodeURIComponent(chat_id);
    const skip = (Number(page) - 1) * Number(limit);

    const [messages, total] = await Promise.all([
      payservedb.WhatsappConversation.find({ chat_id: decodedChatId })
        .sort({ timestamp: 1, created_at: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      payservedb.WhatsappConversation.countDocuments({ chat_id: decodedChatId })
    ]);

    return reply.code(200).send({
      success: true,
      data: messages,
      pagination: {
        current_page: Number(page),
        per_page: Number(limit),
        total_items: total,
        total_pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to get WhatsApp messages',
      details: error.message
    });
  }
}

module.exports = get_messages;
