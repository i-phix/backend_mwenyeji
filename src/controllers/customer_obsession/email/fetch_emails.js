const Imap = require('imap');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const EmailThread = require('../../../models/email_thread');
const CommunicationSettings = require('../../../models/communication_settings');
const emailConfig = require('../../../config/email');
const logger = require('../../../../config/winston');
const { matchAutoReplyRule } = require('../../../utils/auto_reply');

const autoReplyTransporter = nodemailer.createTransport(emailConfig.smtp);

const MAILBOX_CANDIDATES = {
  INBOX: ['INBOX'],
  SENT: ['Sent', 'Sent Items', 'INBOX.Sent', '[Gmail]/Sent Mail'],
  SPAM: ['Spam', 'Junk', 'INBOX.Spam', '[Gmail]/Spam']
};

function flattenBoxes(boxes, prefix = '') {
  const names = [];
  if (!boxes || typeof boxes !== 'object') return names;
  for (const [name, meta] of Object.entries(boxes)) {
    const delimiter = meta?.delimiter || '.';
    const full = prefix ? `${prefix}${delimiter}${name}` : name;
    names.push(full);
    if (meta?.children) names.push(...flattenBoxes(meta.children, full));
  }
  return names;
}

function buildImapConfig(hostOverride) {
  return {
    ...emailConfig.imap,
    host: hostOverride || emailConfig.imap.host
  };
}

function getImapHostCandidates() {
  const configured = String(process.env.CO_EMAIL_IMAP_HOSTS || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  const defaults = [emailConfig.imap.host, 'imap.zoho.com', 'imappro.zoho.com'].filter(Boolean);
  return Array.from(new Set([...configured, ...defaults]));
}

function listMailboxes(hostOverride) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(buildImapConfig(hostOverride));
    let settled = false;
    const done = (err, val) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(val);
    };

    imap.on('error', (err) => done(err));
    imap.once('ready', () => {
      imap.getBoxes((err, boxes) => {
        if (err) {
          imap.end();
          return done(err);
        }
        const names = flattenBoxes(boxes);
        imap.end();
        return done(null, names);
      });
    });
    imap.connect();
  });
}

function resolveMailbox(canonicalFolder, availableNames) {
  const names = Array.isArray(availableNames) ? availableNames : [];
  const lowerNames = names.map((n) => ({ raw: n, norm: String(n).toLowerCase() }));
  if (canonicalFolder === 'INBOX') {
    return lowerNames.find((n) => n.norm === 'inbox')?.raw || 'INBOX';
  }
  const keywords = canonicalFolder === 'SENT'
    ? ['sent', 'sent items', 'sent mail']
    : ['spam', 'junk'];
  const byKeyword = lowerNames.find((n) => keywords.some((k) => n.norm.includes(k)));
  if (byKeyword) return byKeyword.raw;
  const fallbackCandidates = MAILBOX_CANDIDATES[canonicalFolder] || [];
  const byFallback = fallbackCandidates.find((candidate) =>
    lowerNames.some((n) => n.norm === candidate.toLowerCase())
  );
  return byFallback || null;
}

function fetchRawMessagesFromMailbox(mailbox, limit = 50, hostOverride) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err, val) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(val);
    };

    const imap = new Imap(buildImapConfig(hostOverride));
    const messages = [];

    imap.on('error', (err) => done(err));

    imap.once('ready', () => {
      imap.openBox(mailbox, true, (openErr, box) => {
        if (openErr) {
          imap.destroy();
          return done(openErr);
        }

        const total = box.messages.total || 0;
        if (total === 0) {
          imap.end();
          return done(null, []);
        }

        const start = Math.max(1, total - limit + 1);
        const fetch = imap.seq.fetch(`${start}:${total}`, { bodies: '', struct: true });

        fetch.on('message', (msg) => {
          let raw = '';
          let uid = null;
          msg.on('attributes', (attrs) => { uid = attrs.uid; });
          msg.on('body', (stream) => {
            stream.on('data', (chunk) => { raw += chunk.toString('utf8'); });
          });
          msg.once('end', () => {
            if (raw) messages.push({ raw, uid, mailbox });
          });
        });

        fetch.once('error', (err) => {
          imap.end();
          done(err);
        });

        fetch.once('end', () => {
          imap.end();
          done(null, messages);
        });
      });
    });

    imap.connect();
  });
}

async function fetchMailboxWithFallback(canonicalFolder, limit = 50) {
  const hosts = getImapHostCandidates();
  let mailboxError = null;

  for (const host of hosts) {
    let availableNames = [];
    try {
      availableNames = await listMailboxes(host);
    } catch (error) {
      mailboxError = error;
      logger.warn(`IMAP mailbox listing failed on ${host}: ${error.message}`);
      continue;
    }

    const resolved = resolveMailbox(canonicalFolder, availableNames);
    if (!resolved) {
      logger.warn(`No mailbox resolved for ${canonicalFolder} on ${host}. Available: ${availableNames.join(', ')}`);
      continue;
    }

    try {
      const items = await fetchRawMessagesFromMailbox(resolved, limit, host);
      return { canonicalFolder, mailbox: resolved, items, error: mailboxError, host };
    } catch (error) {
      mailboxError = error;
      logger.warn(`IMAP open/fetch failed for mailbox "${resolved}" on ${host}: ${error.message}`);
    }
  }

  const errorWithHosts = mailboxError || new Error(`No mailbox resolved for ${canonicalFolder}`);
  errorWithHosts.hostsTried = hosts.join(', ');
  return { canonicalFolder, mailbox: null, items: [], error: errorWithHosts, host: null };
}

function parseAddressList(listObj) {
  if (!listObj || !Array.isArray(listObj.value)) return [];
  return listObj.value.map((v) => v.address).filter(Boolean);
}

async function fetch_emails(request, reply) {
  const mailboxAccount = String(emailConfig.imap.user || '').trim().toLowerCase();
  const perMailboxLimit = Number(request.query.limit_per_folder || 50);
  let imapSyncError = null;

  let rawMessages = [];
  try {
    const [inbox, sent, spam] = await Promise.all([
      fetchMailboxWithFallback('INBOX', perMailboxLimit),
      fetchMailboxWithFallback('SENT', perMailboxLimit),
      fetchMailboxWithFallback('SPAM', perMailboxLimit)
    ]);

    const mailboxErrors = [inbox.error, sent.error, spam.error].filter(Boolean);
    if (mailboxErrors.length > 0) {
      imapSyncError = mailboxErrors[0];
    }

    rawMessages = [
      ...inbox.items.map((m) => ({ ...m, canonicalFolder: 'INBOX' })),
      ...sent.items.map((m) => ({ ...m, canonicalFolder: 'SENT' })),
      ...spam.items.map((m) => ({ ...m, canonicalFolder: 'SPAM' }))
    ];

    logger.info(`fetch_emails: INBOX=${inbox.items.length}, SENT=${sent.items.length}, SPAM=${spam.items.length}`);
  } catch (imapErr) {
    imapSyncError = imapErr;
    logger.error(`fetch_emails IMAP error (returning DB cache): ${imapErr.message}`);
  }

  for (const item of rawMessages) {
    try {
      const parsed = await simpleParser(item.raw);
      const messageId = parsed.messageId || `${item.canonicalFolder.toLowerCase()}-uid-${item.uid || Date.now()}`;
      const threadId = (Array.isArray(parsed.references) && parsed.references[0]) || parsed.inReplyTo || messageId;
      const fromAddress = parsed.from?.value?.[0]?.address || '';
      const fromName = parsed.from?.value?.[0]?.name || '';
      const toList = parseAddressList(parsed.to);
      const ccList = parseAddressList(parsed.cc);

      const isNew = !(await EmailThread.exists({ message_id: messageId }));
      await EmailThread.findOneAndUpdate(
        { message_id: messageId },
        {
          $set: {
            message_id: messageId,
            thread_id: threadId,
            in_reply_to: parsed.inReplyTo || '',
            references: Array.isArray(parsed.references) ? parsed.references.join(' ') : (parsed.references || ''),
            from_email: fromAddress,
            from_name: fromName,
            to_email: toList.join(', '),
            cc_email: ccList.join(', '),
            subject: parsed.subject || '(no subject)',
            body_text: parsed.text || '',
            body_html: parsed.html ? String(parsed.html) : '',
            date: parsed.date || new Date(),
            uid: item.uid,
            folder: item.canonicalFolder,
            mailbox_account: mailboxAccount
          },
          $setOnInsert: {
            created_at: new Date(),
            is_read: item.canonicalFolder !== 'INBOX',
            is_replied: false
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Auto-reply for new INBOX emails — uses the admin-managed
      // AutoReplyRule list (PR4). First keyword match wins. Matcher already
      // skips @payserve.co.ke senders, so we only need a basic loop guard
      // against bounce / OOF / vacation responder subjects.
      if (isNew && item.canonicalFolder === 'INBOX' && fromAddress && String(fromAddress).toLowerCase() !== mailboxAccount) {
        const subjectLower = String(parsed.subject || '').toLowerCase();
        const isLoopHeader = subjectLower.startsWith('auto:')
          || subjectLower.startsWith('automatic reply')
          || subjectLower.startsWith('out of office');
        if (!isLoopHeader) {
          try {
            const matchBody = `${parsed.subject || ''}\n\n${parsed.text || ''}`;
            const match = await matchAutoReplyRule({
              channel: 'email',
              body: matchBody,
              senderAddress: fromAddress,
            });
            if (match) {
              const baseSubject = parsed.subject || 'Support Request';
              // No CC — auto-replies bypass the always-CC list (PR4 spec).
              await autoReplyTransporter.sendMail({
                from: emailConfig.smtp.auth.user,
                to: fromAddress,
                subject: `Auto: Re: ${baseSubject}`,
                text: match.rule.reply,
                inReplyTo: messageId,
                references: messageId,
              });
              logger.info(`[auto-reply] email rule "${match.matched}" → ${fromAddress}`);
            }
          } catch (arErr) {
            logger.warn(`[auto-reply] email auto-reply failed: ${arErr.message}`);
          }
        }
      }
    } catch (parseErr) {
      logger.warn(`fetch_emails: skipping message - ${parseErr.message}`);
    }
  }

  try {
    const page = Number(request.query.page || 1);
    const limit = Number(request.query.limit || 20);
    const folder = request.query.folder ? String(request.query.folder).toUpperCase() : undefined;
    const query = { mailbox_account: mailboxAccount };
    if (folder) {
      query.folder = folder;
    }
    const skip = (page - 1) * limit;

    const [emails, total, folderCountsRaw] = await Promise.all([
      EmailThread.find(query).sort({ date: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
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

    if (imapSyncError && rawMessages.length === 0 && emails.length === 0) {
      // Return 200 with empty data and warning — don't block the UI with a 502
      logger.warn(`fetch_emails: IMAP unreachable and DB empty. Details: ${imapSyncError.message}`);
    }

    return reply.code(200).send({
      success: true,
      message: rawMessages.length > 0
        ? `Synced ${rawMessages.length} emails`
        : (imapSyncError ? 'IMAP unavailable, returned cached emails' : 'No new emails'),
      warning: imapSyncError ? (imapSyncError.message || 'IMAP sync error') : undefined,
      data: emails,
      folder_counts,
      pagination: {
        current_page: page,
        per_page: limit,
        total_items: total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (dbErr) {
    logger.error(`fetch_emails DB error: ${dbErr.message}`);
    return reply.code(500).send({ success: false, error: 'Database error', details: dbErr.message });
  }
}

module.exports = fetch_emails;
