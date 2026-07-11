const payservedb = require('payservedb');

const normalizeChatId = (chatId = '') => {
  const clean = String(chatId || '').trim();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  const digits = clean.replace(/\D/g, '');
  return digits ? `${digits}@c.us` : '';
};

const extractPhoneFromChatId = (chatId = '') => String(chatId || '').replace('@c.us', '').replace(/\D/g, '');

async function add_contact(request, reply) {
  try {
    const { phone, contact_name, chat_id } = request.body || {};
    const resolvedChatId = normalizeChatId(chat_id || phone);
    const resolvedName = String(contact_name || '').trim();

    if (!resolvedChatId) {
      return reply.code(400).send({ success: false, error: 'phone or chat_id is required' });
    }

    if (!resolvedName) {
      return reply.code(400).send({ success: false, error: 'contact_name is required' });
    }

    const contactPhone = extractPhoneFromChatId(resolvedChatId);
    await payservedb.WhatsappConversation.updateMany(
      { chat_id: resolvedChatId },
      {
        $set: {
          contact_name: resolvedName,
          contact_phone: contactPhone
        }
      }
    );

    const existing = await payservedb.WhatsappConversation.findOne({ chat_id: resolvedChatId }).lean();
    if (!existing) {
      await payservedb.WhatsappConversation.create({
        wa_message_id: `manual_contact_${resolvedChatId}`,
        chat_id: resolvedChatId,
        contact_name: resolvedName,
        contact_phone: contactPhone,
        direction: 'outbound',
        message_text: '',
        message_type: 'text',
        timestamp: new Date(0),
        is_read: true
      });
    }

    return reply.code(200).send({
      success: true,
      message: 'Contact saved successfully',
      data: {
        chat_id: resolvedChatId,
        contact_name: resolvedName,
        contact_phone: contactPhone
      }
    });
  } catch (error) {
    return reply.code(500).send({ success: false, error: `Failed to save contact: ${error.message}` });
  }
}

module.exports = add_contact;

