const cron = require('node-cron');
const mongoose = require('mongoose');
const { getModel } = require('../utils/database2');

const DATABASE_NAME = 'utility_database';

const WaterMeterSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    collection: 'watermeters',
  }
);

const EscalatedMeterSchema = new mongoose.Schema(
  {
    meterId: {
      type: mongoose.Schema.Types.ObjectId,
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
      index: true,
    },

    meterUpdatedAt: {
      type: Date,
      default: null,
      index: true,
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
      enum: ['active'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'escalated_meters',
  }
);

async function getModels() {
  const WaterMeter = await getModel(
    DATABASE_NAME,
    'WaterMeter',
    WaterMeterSchema
  );

  const EscalatedMeter = await getModel(
    DATABASE_NAME,
    'EscalatedMeter',
    EscalatedMeterSchema
  );

  return {
    WaterMeter,
    EscalatedMeter,
  };
}

async function runEscalatedMetersCheck() {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  console.log('==========================================');
  console.log('[EscalatedMetersCron] Started');
  console.log('[EscalatedMetersCron] Database:', DATABASE_NAME);
  console.log('[EscalatedMetersCron] Checking meters older than:', twoDaysAgo);
  console.log('==========================================');

  try {
    const { WaterMeter, EscalatedMeter } = await getModels();

    /**
     * Find stale meters.
     *
     * Condition:
     * - protocol = PAYSERVE_TCP
     * - updatedAt is older than 2 days or missing
     * - lastReadingDate is older than 2 days or missing
     */
    const staleMeters = await WaterMeter.find({
      protocol: 'PAYSERVE_TCP',
      $and: [
        {
          $or: [
            { updatedAt: { $lt: twoDaysAgo } },
            { updatedAt: { $exists: false } },
            { updatedAt: null },
          ],
        },
        {
          $or: [
            { lastReadingDate: { $lt: twoDaysAgo } },
            { lastReadingDate: { $exists: false } },
            { lastReadingDate: null },
          ],
        },
      ],
    }).lean();

    console.log(
      `[EscalatedMetersCron] Stale PAYSERVE_TCP meters found: ${staleMeters.length}`
    );

    let createdOrUpdatedCount = 0;

    for (const meter of staleMeters) {
      await EscalatedMeter.findOneAndUpdate(
        {
          meterId: meter._id,
        },
        {
          $set: {
            meterId: meter._id,
            accountNumber: meter.accountNumber || null,
            protocol: meter.protocol,

            manufacturer: meter.manufacturer || null,
            meterType: meter.meterType || null,
            size: meter.size || null,
            concentratorSerialNumber:
              meter.concentratorSerialNumber || null,

            facilityId: meter.facilityId || null,
            unitId: meter.unitId || null,
            customerId: meter.customerId || null,

            currentReading:
              typeof meter.currentReading === 'number'
                ? meter.currentReading
                : 0,

            previousReading:
              typeof meter.previousReading === 'number'
                ? meter.previousReading
                : 0,

            lastReadingDate: meter.lastReadingDate || null,
            meterUpdatedAt: meter.updatedAt || null,

            lastCheckedAt: now,
            status: 'active',
            reason:
              'PAYSERVE_TCP meter has not updated for more than 2 days',
          },
          $setOnInsert: {
            escalatedAt: now,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      createdOrUpdatedCount++;

      console.log(
        `[EscalatedMetersCron] Escalated/updated meter: ${meter._id} | accountNumber: ${meter.accountNumber || 'N/A'}`
      );
    }

    /**
     * Remove recovered meters.
     *
     * If a meter exists in escalated_meters but has now updated within
     * the last 2 days, delete it from escalated_meters.
     */
    const activeEscalations = await EscalatedMeter.find({
      status: 'active',
    }).lean();

    console.log(
      `[EscalatedMetersCron] Active escalation records found: ${activeEscalations.length}`
    );

    let removedCount = 0;

    for (const escalation of activeEscalations) {
      const meter = await WaterMeter.findById(escalation.meterId).lean();

      /**
       * If original meter no longer exists, remove escalation record.
       */
      if (!meter) {
        await EscalatedMeter.deleteOne({
          _id: escalation._id,
        });

        removedCount++;

        console.log(
          `[EscalatedMetersCron] Removed escalation because meter no longer exists: ${escalation.meterId}`
        );

        continue;
      }

      const updatedAt = meter.updatedAt ? new Date(meter.updatedAt) : null;

      const lastReadingDate = meter.lastReadingDate
        ? new Date(meter.lastReadingDate)
        : null;

      const meterUpdatedRecently =
        updatedAt && updatedAt >= twoDaysAgo;

      const readingUpdatedRecently =
        lastReadingDate && lastReadingDate >= twoDaysAgo;

      if (meterUpdatedRecently || readingUpdatedRecently) {
        await EscalatedMeter.deleteOne({
          _id: escalation._id,
        });

        removedCount++;

        console.log(
          `[EscalatedMetersCron] Removed recovered meter: ${meter._id} | accountNumber: ${meter.accountNumber || 'N/A'}`
        );
      }
    }

    console.log('==========================================');
    console.log('[EscalatedMetersCron] Finished successfully');
    console.log(`[EscalatedMetersCron] Escalated/updated: ${createdOrUpdatedCount}`);
    console.log(`[EscalatedMetersCron] Removed/recovered: ${removedCount}`);
    console.log('==========================================');
  } catch (error) {
    console.error('[EscalatedMetersCron] Failed:', error.message);
    console.error(error);
  }
}

function startEscalatedMetersCron() {
  /**
   * Runs twice a day:
   * - 6:00 AM
   * - 6:00 PM
   */
  cron.schedule('0 6,18 * * *', async () => {
    await runEscalatedMetersCheck();
  });

  console.log('[EscalatedMetersCron] Scheduled successfully to run twice daily at 6:00 AM and 6:00 PM');

  /**
   * Optional: run immediately when server starts.
   * Remove this line if you only want it to run at 6 AM and 6 PM.
   */
  runEscalatedMetersCheck();
}

module.exports = {
  startEscalatedMetersCron,
  runEscalatedMetersCheck,
};