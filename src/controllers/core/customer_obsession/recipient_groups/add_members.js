const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');
const { normalisePhone } = require('../../../../utils/phone');

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RX = /^\+?[0-9\s\-()]{7,}$/;

/**
 * POST /api/core/customer_obsession/recipient-groups/:id/members
 * body { members: [{ customer_id?, email?, phone?, name? }, ...] }
 *
 * Enforces:
 *   - Channel-shape requirements (email needed for email groups, phone for
 *     whatsapp, both for 'both')
 *   - Group cap (CO_MAX_MEMBERS_PER_GROUP, default 500)
 *   - Dedup within the group by customer_id OR by lowercased email/phone
 */
async function add_members(request, reply) {
  try {
    const { id } = request.params;
    const { members } = request.body || {};
    if (!id) return reply.code(400).send({ success: false, error: 'id is required' });
    if (!Array.isArray(members) || members.length === 0) {
      return reply.code(400).send({ success: false, error: 'members array is required' });
    }

    const group = await payservedb.RecipientGroup.findById(id);
    if (!group) return reply.code(404).send({ success: false, error: 'Group not found' });

    const cap = Number(process.env.CO_MAX_MEMBERS_PER_GROUP) || 500;
    const currentCount = await payservedb.RecipientGroupMember.countDocuments({ group_id: id });

    // Normalize + validate each member
    const cleaned = [];
    for (const raw of members) {
      const customerId = raw?.customer_id || null;
      const email = raw?.email ? String(raw.email).trim().toLowerCase() : null;
      // Normalise the phone to E.164 (digits-only, leading country code).
      // Stored format: 254XXXXXXXXX. Green API needs this exact shape.
      const rawPhone = raw?.phone ? String(raw.phone).trim() : null;
      const phone = rawPhone ? (normalisePhone(rawPhone) || null) : null;
      const name = raw?.name ? String(raw.name).trim().slice(0, 200) : null;

      if (group.channel === 'email' && !email && !customerId) continue;
      if (group.channel === 'whatsapp' && !phone && !customerId) continue;
      if (group.channel === 'both' && !customerId && !(email && phone)) continue;
      if (email && !EMAIL_RX.test(email)) continue;
      if (phone && !PHONE_RX.test(phone)) continue;

      cleaned.push({ customer_id: customerId, email, phone, name });
    }

    if (cleaned.length === 0) {
      return reply.code(400).send({ success: false, error: 'No valid members supplied' });
    }

    if (currentCount + cleaned.length > cap) {
      return reply.code(400).send({
        success: false,
        error: `Adding ${cleaned.length} would exceed the ${cap}-member cap (currently ${currentCount})`,
      });
    }

    // Dedup against existing members
    const existing = await payservedb.RecipientGroupMember.find({ group_id: id }).lean();
    const seenCustomers = new Set(existing.filter((m) => m.customer_id).map((m) => String(m.customer_id)));
    const seenEmails = new Set(existing.filter((m) => m.email).map((m) => m.email));
    const seenPhones = new Set(existing.filter((m) => m.phone).map((m) => m.phone));

    const toInsert = [];
    let skipped = 0;
    for (const m of cleaned) {
      const dupCustomer = m.customer_id && seenCustomers.has(String(m.customer_id));
      const dupEmail = m.email && seenEmails.has(m.email);
      const dupPhone = m.phone && seenPhones.has(m.phone);
      if (dupCustomer || dupEmail || dupPhone) { skipped += 1; continue; }
      toInsert.push({
        group_id: id,
        customer_id: m.customer_id || undefined,
        email: m.email || undefined,
        phone: m.phone || undefined,
        name: m.name || undefined,
        added_by: request.user?.userId,
      });
      if (m.customer_id) seenCustomers.add(String(m.customer_id));
      if (m.email) seenEmails.add(m.email);
      if (m.phone) seenPhones.add(m.phone);
    }

    let inserted = [];
    if (toInsert.length > 0) {
      inserted = await payservedb.RecipientGroupMember.insertMany(toInsert, { ordered: false });
      group.member_count = currentCount + inserted.length;
      group.updated_by = request.user?.userId;
      await group.save();
    }

    return reply.code(200).send({
      success: true,
      data: { added: inserted.length, skipped, members: inserted },
    });
  } catch (err) {
    logger.error('add_members error', err);
    return reply.code(500).send({ success: false, error: 'Failed to add members' });
  }
}

module.exports = add_members;
