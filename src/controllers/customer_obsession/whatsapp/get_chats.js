const payservedb = require('payservedb');

async function get_chats(request, reply) {
  try {
    const chats = await payservedb.WhatsappConversation.aggregate([
      { $sort: { timestamp: -1, created_at: -1 } },
      {
        $group: {
          _id: '$chat_id',
          chat_id: { $first: '$chat_id' },
          contact_name: { $first: '$contact_name' },
          contact_phone: { $first: '$contact_phone' },
          last_message: { $first: '$message_text' },
          last_message_type: { $first: '$message_type' },
          last_timestamp: { $first: '$timestamp' },
          linked_ticket_id: { $first: '$linked_ticket_id' },
          unread_count: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$direction', 'inbound'] }, { $eq: ['$is_read', false] }] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { last_timestamp: -1 } }
    ]);

    return reply.code(200).send({
      success: true,
      data: chats
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to get WhatsApp chats',
      details: error.message
    });
  }
}

module.exports = get_chats;
