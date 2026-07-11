const mongoose = require('mongoose');

const ReadingLimitSettingSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: 'GLOBAL_METER_READING_LIMIT',
      unique: true,
      index: true,
    },

    /**
     * This is no longer the absolute meter reading.
     * It is the maximum allowed usage difference between:
     * previous reading and current reading.
     *
     * Example:
     * previous = 5000
     * current = 6200
     * usageDifference = 1200
     *
     * If maxReading = 1000, this meter is escalated.
     */
    maxReading: {
      type: Number,
      required: true,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: String,
      default: null,
    },

    updatedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'reading_limit_settings',
  }
);

const ReadingExceededMeterSchema = new mongoose.Schema(
  {
    /**
     * Because the meter update service is different,
     * do not force ObjectId only.
     *
     * Your meter service uses meter_sn / meterIDDec.
     * So we save that value here as meterNumber.
     */
    meterNumber: {
      type: String,
      required: true,
      index: true,
    },

    /**
     * Optional MongoDB meter id, only if the caller has it.
     */
    meterId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    accountNumber: {
      type: String,
      default: null,
      index: true,
    },

    meterSn: {
      type: String,
      default: null,
      index: true,
    },

    protocol: {
      type: String,
      default: null,
      index: true,
    },

    manufacturer: {
      type: String,
      default: null,
    },

    meterType: {
      type: String,
      default: null,
    },

    size: {
      type: String,
      default: null,
    },

    concentratorSerialNumber: {
      type: String,
      default: null,
      index: true,
    },

    concentratorId: {
      type: String,
      default: null,
      index: true,
    },

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

    previousReading: {
      type: Number,
      default: 0,
    },

    currentReading: {
      type: Number,
      required: true,
    },

    /**
     * This is the important field for your new logic.
     */
    usageDifference: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },

    /**
     * The configured maximum allowed usage difference.
     */
    maxReading: {
      type: Number,
      required: true,
    },

    exceededBy: {
      type: Number,
      default: 0,
    },

    valveStatus: {
      type: String,
      default: null,
    },

    statusText: {
      type: String,
      default: null,
    },

    voltage: {
      type: Number,
      default: null,
    },

    pulseConstant: {
      type: String,
      default: null,
    },

    meteringMode: {
      type: String,
      default: null,
    },

    deviceMeterType: {
      type: String,
      default: null,
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
      default: 'Meter usage difference has exceeded the configured maximum usage limit',
    },

    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    status: {
      type: String,
      enum: ['active'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'reading_exceeded_meters',
  }
);

/**
 * Prevent duplicate active escalation for the same meter.
 * This is better than `unique: true` on meterId because some callers
 * will not have the MongoDB ObjectId.
 */
ReadingExceededMeterSchema.index(
  {
    meterNumber: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: 'active',
    },
  }
);

const WaterMeterSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    collection: 'watermeters',
  }
);

module.exports = {
  ReadingLimitSettingSchema,
  ReadingExceededMeterSchema,
  WaterMeterSchema,
};