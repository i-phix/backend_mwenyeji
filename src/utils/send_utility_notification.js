const { sendSms } = require('./send_new_sms');
const { sendWhatsappMessage } = require('./send_whatsapp');

/**
 * Fan-out helper for utility notifications (water meter onboarding, bill ready,
 * low balance, payment confirmation, overdue reminders, etc.).
 *
 * Always fires SMS through the existing send_new_sms path. Additionally fires
 * a WhatsApp message via cops Green API when UTILITY_WHATSAPP_ENABLED=true.
 * WhatsApp failure never blocks the SMS path — both calls are awaited in
 * parallel and the WhatsApp result is best-effort.
 *
 * Returns the SMS result (so existing callers that read .success keep working).
 */
async function sendUtilityNotification(facilityId, phone, message, opts = {}) {
  const smsPromise = sendSms(facilityId, phone, message);
  const waPromise = sendWhatsappMessage(phone, message, {
    contactName: opts.contactName,
    source: opts.source || 'system-utility'
  });

  const [smsResult, waResult] = await Promise.allSettled([smsPromise, waPromise]);

  const sms = smsResult.status === 'fulfilled'
    ? smsResult.value
    : { success: false, error: smsResult.reason?.message || 'SMS failed' };

  const whatsapp = waResult.status === 'fulfilled'
    ? waResult.value
    : { success: false, error: waResult.reason?.message || 'WhatsApp failed' };

  return { ...sms, whatsapp };
}

module.exports = { sendUtilityNotification };
