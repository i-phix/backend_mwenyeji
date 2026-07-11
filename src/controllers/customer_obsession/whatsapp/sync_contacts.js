const axios = require('axios');
const payservedb = require('payservedb');
const waConfig = require('../../../config/whatsapp');

const normalizeChatId = (chatId = '') => {
  const clean = String(chatId || '').trim();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  const digits = clean.replace(/\D/g, '');
  return digits ? `${digits}@c.us` : '';
};

const extractPhoneFromChatId = (chatId = '') => String(chatId || '').replace('@c.us', '').replace(/\D/g, '');

const extractContacts = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.contacts)) return payload.contacts;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const mapContact = (row = {}) => {
  const chatId = normalizeChatId(
    row.chatId ||
      row.contactId ||
      row.id ||
      row.waId ||
      row.phoneNumber ||
      row.phone ||
      row.number
  );

  const contactName =
    row.name ||
    row.contactName ||
    row.fullName ||
    row.pushName ||
    row.shortName ||
    row.profileName ||
    '';

  return {
    chatId,
    contactName: String(contactName || '').trim(),
    contactPhone: extractPhoneFromChatId(chatId)
  };
};

async function sync_contacts(request, reply) {
  try {
    if (waConfig.provider !== 'green_api') {
      return reply.code(400).send({ success: false, error: 'Contact sync is only enabled for Green API provider' });
    }

    const { apiUrl, idInstance, apiTokenInstance } = waConfig.green;
    if (!apiUrl || !idInstance || !apiTokenInstance) {
      return reply.code(500).send({ success: false, error: 'Green API is not configured' });
    }

    let response;
    try {
      response = await axios.get(`${apiUrl}/waInstance${idInstance}/getContacts/${apiTokenInstance}`, {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (getError) {
      response = await axios.post(
        `${apiUrl}/waInstance${idInstance}/getContacts/${apiTokenInstance}`,
        {},
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const contacts = extractContacts(response.data).map(mapContact).filter((c) => c.chatId);
    let updated = 0;

    for (const contact of contacts) {
      const updateResult = await payservedb.WhatsappConversation.updateMany(
        { chat_id: contact.chatId },
        {
          $set: {
            contact_name: contact.contactName || contact.contactPhone,
            contact_phone: contact.contactPhone
          }
        }
      );

      if ((updateResult?.modifiedCount || 0) > 0) {
        updated += 1;
      }
    }

    return reply.code(200).send({
      success: true,
      message: 'Contacts synchronized successfully',
      data: {
        total_contacts: contacts.length,
        updated_chats: updated
      }
    });
  } catch (error) {
    const errMsg =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;
    return reply.code(500).send({ success: false, error: `Failed to sync contacts: ${errMsg}` });
  }
}

module.exports = sync_contacts;
