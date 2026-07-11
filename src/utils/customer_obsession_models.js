const mongoose = require('mongoose');

function model(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

function installCustomerObsessionModels(payservedb) {
  if (!payservedb.EmailCcConfig) {
    payservedb.EmailCcConfig = model('EmailCcConfig', new mongoose.Schema({
      address: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
        index: true,
      },
      enabled: { type: Boolean, default: true, index: true },
      added_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }, {
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    }));
  }

  if (!payservedb.RecipientGroup) {
    payservedb.RecipientGroup = model('RecipientGroup', new mongoose.Schema({
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
        unique: true,
        index: true,
      },
      channel: {
        type: String,
        enum: ['email', 'whatsapp', 'both'],
        required: true,
        index: true,
      },
      description: { type: String, trim: true, maxlength: 500 },
      member_count: { type: Number, default: 0, min: 0 },
      created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }, {
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    }));
  }

  if (!payservedb.RecipientGroupMember) {
    const recipientGroupMemberSchema = new mongoose.Schema({
      group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RecipientGroup',
        required: true,
        index: true,
      },
      customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
      name: { type: String, trim: true, maxlength: 200 },
      email: { type: String, trim: true, lowercase: true, maxlength: 254 },
      phone: { type: String, trim: true, maxlength: 30 },
      added_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      added_at: { type: Date, default: Date.now },
    });

    recipientGroupMemberSchema.index({ group_id: 1, customer_id: 1 }, {
      unique: true,
      partialFilterExpression: { customer_id: { $type: 'objectId' } },
    });
    recipientGroupMemberSchema.index({ group_id: 1, email: 1 }, {
      unique: true,
      partialFilterExpression: { email: { $type: 'string' } },
    });
    recipientGroupMemberSchema.index({ group_id: 1, phone: 1 }, {
      unique: true,
      partialFilterExpression: { phone: { $type: 'string' } },
    });

    payservedb.RecipientGroupMember = model('RecipientGroupMember', recipientGroupMemberSchema);
  }

  if (!payservedb.AutoReplyRule) {
    payservedb.AutoReplyRule = model('AutoReplyRule', new mongoose.Schema({
      channel: {
        type: String,
        enum: ['email', 'whatsapp'],
        required: true,
        index: true,
      },
      keyword: { type: String, required: true, trim: true, index: true },
      reply: { type: String, required: true, trim: true, maxlength: 1000 },
      enabled: { type: Boolean, default: true, index: true },
      priority: { type: Number, default: 0, index: true },
      created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }, {
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    }));
  }

  return payservedb;
}

module.exports = installCustomerObsessionModels;
