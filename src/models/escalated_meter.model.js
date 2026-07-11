const mongoose = require('mongoose');

const EscalatedMeterSchema = new mongoose.Schema(
  {
    meterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WaterMeter',
      required: true,
      unique: true,
      index: true,
    },

    accountNumber: {
      type: String,
      default: null,
      index: true,
    },

    protocol: {
      type: String,
      required: true,
      index: true,
    },

    manufacturer: String,
    meterType: String,
    size: String,
    concentratorSerialNumber: String,

    facilityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    currentReading: {
      type: Number,
      default: 0,
    },

    previousReading: {
      type: Number,
      default: 0,
    },

    lastReadingDate: {
      type: Date,
      default: null,
    },

    meterUpdatedAt: {
      type: Date,
      default: null,
    },

    escalatedAt: {
      type: Date,
      default: Date.now,
    },

    lastCheckedAt: {
      type: Date,
      default: Date.now,
    },

    reason: {
      type: String,
      default: 'PAYSERVE_TCP meter has not updated for more than 2 days',
    },

    status: {
      type: String,
      enum: ['active', 'resolved'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'escalated_meters',
  }
);

module.exports = mongoose.model('EscalatedMeter', EscalatedMeterSchema);