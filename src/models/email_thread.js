const mongoose = require('mongoose');

// Defined locally because public payservedb does not include EmailThread
const emailThreadSchema = new mongoose.Schema({
  message_id: { type: String, unique: true, sparse: true },
  thread_id: { type: String },
  from_email: { type: String },
  from_name: { type: String },
  to_email: { type: String },
  cc_email: { type: String },
  subject: { type: String },
  body_text: { type: String },
  body_html: { type: String },
  in_reply_to: { type: String },
  references: { type: String },
  date: { type: Date },
  is_read: { type: Boolean, default: false },
  is_replied: { type: Boolean, default: false },
  replied_at: { type: Date },
  replied_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reply_text: { type: String },
  linked_ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerTicket', default: null },
  linked_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  linked_at: { type: Date },
  uid: { type: Number },
  folder: { type: String, default: 'INBOX' },
  mailbox_account: { type: String },
  auto_replied_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});

emailThreadSchema.index({ date: -1 });
emailThreadSchema.index({ thread_id: 1 });
emailThreadSchema.index({ linked_ticket_id: 1 });
emailThreadSchema.index({ mailbox_account: 1, date: -1 });

// Re-use existing model if already registered (handles hot-reload / cluster workers)
module.exports = mongoose.models.EmailThread || mongoose.model('EmailThread', emailThreadSchema);
