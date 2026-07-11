const EmailThread = require('../../../models/email_thread');
const emailConfig = require('../../../config/email');

async function get_emails(request, reply) {
  try {
    const {
      page = 1,
      limit = 20,
      is_read,
      search,
      folder,
      thread_id
    } = request.query;

    const mailboxAccount = String(emailConfig.imap.user || '').trim().toLowerCase();
    const query = { mailbox_account: mailboxAccount };

    if (is_read !== undefined) {
      query.is_read = String(is_read) === 'true';
    }

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { from_email: { $regex: search, $options: 'i' } },
        { from_name: { $regex: search, $options: 'i' } },
        { to_email: { $regex: search, $options: 'i' } },
        { body_text: { $regex: search, $options: 'i' } }
      ];
    }

    if (folder) {
      query.folder = String(folder).toUpperCase();
    }

    if (thread_id) {
      query.thread_id = String(thread_id);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [emails, total, folderCountsRaw] = await Promise.all([
      EmailThread.find(query)
        .populate('linked_ticket_id', 'ticket_number _id')
        .sort({ date: -1, created_at: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      EmailThread.countDocuments(query),
      EmailThread.aggregate([
        { $match: { mailbox_account: mailboxAccount } },
        { $group: { _id: '$folder', count: { $sum: 1 } } }
      ])
    ]);

    const folder_counts = folderCountsRaw.reduce((acc, item) => {
      const key = String(item._id || '').toUpperCase();
      if (key) acc[key] = item.count;
      return acc;
    }, { INBOX: 0, SENT: 0, SPAM: 0 });

    return reply.code(200).send({
      success: true,
      data: emails,
      folder_counts,
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
      error: 'Failed to retrieve emails',
      details: error.message
    });
  }
}

module.exports = get_emails;
