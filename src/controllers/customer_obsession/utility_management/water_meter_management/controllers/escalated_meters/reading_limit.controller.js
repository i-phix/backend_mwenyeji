const mongoose = require('mongoose');
const { getModel } = require('../../../../../../utils/database2');

const {
  ReadingLimitSettingSchema,
  ReadingExceededMeterSchema,
} = require('../../../../../../models/reading_limit_escalation.models');

const DATABASE_NAME = 'utility_database';
const LIMIT_SETTING_NAME = 'GLOBAL_METER_READING_LIMIT';

/**
 * Simple in-memory cache.
 * This avoids querying the reading limit setting on every meter update.
 */
let readingLimitCache = {
  value: null,
  isActive: false,
  setting: null,
  fetchedAt: null,
};

async function getReadingLimitModels() {
  const ReadingLimitSetting = await getModel(
    DATABASE_NAME,
    'ReadingLimitSetting',
    ReadingLimitSettingSchema
  );

  const ReadingExceededMeter = await getModel(
    DATABASE_NAME,
    'ReadingExceededMeter',
    ReadingExceededMeterSchema
  );

  return {
    ReadingLimitSetting,
    ReadingExceededMeter,
  };
}

function setReadingLimitCache(setting) {
  if (!setting || !setting.isActive) {
    readingLimitCache = {
      value: null,
      isActive: false,
      setting: null,
      fetchedAt: new Date(),
    };

    return readingLimitCache;
  }

  const maxReading = Number(setting.maxReading);

  if (Number.isNaN(maxReading)) {
    readingLimitCache = {
      value: null,
      isActive: false,
      setting: null,
      fetchedAt: new Date(),
    };

    return readingLimitCache;
  }

  readingLimitCache = {
    value: maxReading,
    isActive: true,
    setting,
    fetchedAt: new Date(),
  };

  return readingLimitCache;
}

async function refreshReadingLimitCache() {
  const { ReadingLimitSetting } = await getReadingLimitModels();

  const setting = await ReadingLimitSetting.findOne({
    name: LIMIT_SETTING_NAME,
  }).lean();

  return setReadingLimitCache(setting);
}

async function getCachedReadingLimit() {
  if (readingLimitCache.fetchedAt) {
    return readingLimitCache;
  }

  return refreshReadingLimitCache();
}

async function createOrUpdateReadingLimit(request, reply) {
  try {
    const { maxReading, isActive = true } = request.body || {};

    if (maxReading === undefined || maxReading === null || maxReading === '') {
      return reply.code(400).send({
        success: false,
        message: 'maxReading is required',
      });
    }

    const numericMaxReading = Number(maxReading);

    if (Number.isNaN(numericMaxReading) || numericMaxReading < 0) {
      return reply.code(400).send({
        success: false,
        message: 'maxReading must be a valid number greater than or equal to 0',
      });
    }

    const { ReadingLimitSetting } = await getReadingLimitModels();

    const userId =
      request.user?.userId ||
      request.user?._id ||
      request.user?.id ||
      null;

    const setting = await ReadingLimitSetting.findOneAndUpdate(
      {
        name: LIMIT_SETTING_NAME,
      },
      {
        $set: {
          maxReading: numericMaxReading,
          isActive: Boolean(isActive),
          updatedBy: userId,
        },
        $setOnInsert: {
          name: LIMIT_SETTING_NAME,
          createdBy: userId,
        },
      },
      {
        upsert: true,
        new: true,
      }
    ).lean();

    /**
     * Important:
     * We only refresh the cache here.
     * We do NOT scan old saved meters again.
     */
    setReadingLimitCache(setting);

    return reply.code(200).send({
      success: true,
      message: 'Reading limit saved successfully',
      data: setting,
    });
  } catch (error) {
    console.error('[createOrUpdateReadingLimit] Failed:', error);

    return reply.code(500).send({
      success: false,
      message: 'Failed to save reading limit',
      error: error.message,
    });
  }
}

async function getReadingLimit(request, reply) {
  try {
    const { ReadingLimitSetting } = await getReadingLimitModels();

    const setting = await ReadingLimitSetting.findOne({
      name: LIMIT_SETTING_NAME,
    }).lean();

    setReadingLimitCache(setting);

    return reply.code(200).send({
      success: true,
      message: 'Reading limit fetched successfully',
      data: setting,
    });
  } catch (error) {
    console.error('[getReadingLimit] Failed:', error);

    return reply.code(500).send({
      success: false,
      message: 'Failed to fetch reading limit',
      error: error.message,
    });
  }
}

async function deleteReadingLimit(request, reply) {
  try {
    const { ReadingLimitSetting, ReadingExceededMeter } =
      await getReadingLimitModels();

    await ReadingLimitSetting.deleteOne({
      name: LIMIT_SETTING_NAME,
    });

    await ReadingExceededMeter.deleteMany({});

    setReadingLimitCache(null);

    return reply.code(200).send({
      success: true,
      message: 'Reading limit and exceeded meter records deleted successfully',
    });
  } catch (error) {
    console.error('[deleteReadingLimit] Failed:', error);

    return reply.code(500).send({
      success: false,
      message: 'Failed to delete reading limit',
      error: error.message,
    });
  }
}

/**
 * This endpoint is called by the meter update flow only when:
 * usageDifference > cached maxReading
 *
 * It prevents duplicate active records for the same meter by using:
 * { meterId, status: 'active' }
 */


async function getReadingExceededMeters(request, reply) {
  try {
    const { ReadingExceededMeter } = await getReadingLimitModels();

    const {
      page = 1,
      limit = 20,
      search = '',
      protocol,
      facilityId,
      unitId,
      sortBy = 'exceededBy',
      sortOrder = 'desc',
    } = request.query || {};

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const query = {
      status: 'active',
    };

    if (protocol) {
      query.protocol = protocol;
    }

    if (facilityId && mongoose.Types.ObjectId.isValid(facilityId)) {
      query.facilityId = new mongoose.Types.ObjectId(facilityId);
    }

    if (unitId && mongoose.Types.ObjectId.isValid(unitId)) {
      query.unitId = new mongoose.Types.ObjectId(unitId);
    }

    if (search && search.trim()) {
      const value = search.trim();
      const searchRegex = new RegExp(value, 'i');

      query.$or = [
        { accountNumber: searchRegex },
        { protocol: searchRegex },
        { manufacturer: searchRegex },
        { meterType: searchRegex },
        { size: searchRegex },
        { concentratorSerialNumber: searchRegex },
        { reason: searchRegex },
      ];

      if (mongoose.Types.ObjectId.isValid(value)) {
        query.$or.push({
          meterId: new mongoose.Types.ObjectId(value),
        });
      }
    }

    const allowedSortFields = [
      'accountNumber',
      'currentReading',
      'previousReading',
      'usageDifference',
      'maxReading',
      'exceededBy',
      'lastReadingDate',
      'meterUpdatedAt',
      'escalatedAt',
      'lastCheckedAt',
      'createdAt',
      'updatedAt',
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'exceededBy';

    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [records, totalRecords] = await Promise.all([
      ReadingExceededMeter.find(query)
        .sort({ [safeSortBy]: sortDirection })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      ReadingExceededMeter.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalRecords / limitNumber);

    return reply.code(200).send({
      success: true,
      message: 'Reading exceeded meters fetched successfully',
      data: records,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalRecords,
        limit: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    console.error('[getReadingExceededMeters] Failed:', error);

    return reply.code(500).send({
      success: false,
      message: 'Failed to fetch reading exceeded meters',
      error: error.message,
    });
  }
}

async function deleteReadingExceededMeter(request, reply) {
  try {
    const { id } = request.params || {};

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return reply.code(400).send({
        success: false,
        message: 'Valid exceeded meter record id is required',
      });
    }

    const { ReadingExceededMeter } = await getReadingLimitModels();

    const deleted = await ReadingExceededMeter.findByIdAndDelete(id).lean();

    if (!deleted) {
      return reply.code(404).send({
        success: false,
        message: 'Exceeded meter record not found',
      });
    }

    return reply.code(200).send({
      success: true,
      message: 'Exceeded meter record deleted successfully',
      data: deleted,
    });
  } catch (error) {
    console.error('[deleteReadingExceededMeter] Failed:', error);

    return reply.code(500).send({
      success: false,
      message: 'Failed to delete exceeded meter record',
      error: error.message,
    });
  }
}

async function registerReadingExceededMeter(request, reply) {
  try {
    const { ReadingExceededMeter } = await getReadingLimitModels();

    const body = request.body || {};

    const meterNumber = String(
      body.meterNumber ||
      body.meterSn ||
      body.meter_sn ||
      body.meterID ||
      ''
    ).trim();

    if (!meterNumber) {
      return reply.code(400).send({
        success: false,
        message: 'meterNumber is required',
      });
    }

    const previousReading = Number(body.previousReading || 0);
    const currentReading = Number(body.currentReading);
    const usageDifference = Number(body.usageDifference);
    const maxReading = Number(body.maxReading);

    if (Number.isNaN(currentReading)) {
      return reply.code(400).send({
        success: false,
        message: 'currentReading must be a valid number',
      });
    }

    if (Number.isNaN(usageDifference)) {
      return reply.code(400).send({
        success: false,
        message: 'usageDifference must be a valid number',
      });
    }

    if (Number.isNaN(maxReading)) {
      return reply.code(400).send({
        success: false,
        message: 'maxReading must be a valid number',
      });
    }

    if (usageDifference <= maxReading) {
      return reply.code(200).send({
        success: true,
        skipped: true,
        message: 'Usage difference is within the allowed limit',
      });
    }

    const now = new Date();
    const exceededBy = Number((usageDifference - maxReading).toFixed(2));

    const meterId =
      body.meterId && mongoose.Types.ObjectId.isValid(body.meterId)
        ? new mongoose.Types.ObjectId(body.meterId)
        : null;

    const record = await ReadingExceededMeter.findOneAndUpdate(
      {
        meterNumber,
        status: 'active',
      },
      {
        $set: {
          meterNumber,
          meterId,

          accountNumber: body.accountNumber || null,
          meterSn: body.meterSn || body.meter_sn || meterNumber,

          protocol: body.protocol || null,
          manufacturer: body.manufacturer || null,
          meterType: body.meterType || null,
          size: body.size || null,

          concentratorSerialNumber: body.concentratorSerialNumber || null,
          concentratorId: body.concentratorId || null,

          facilityId:
            body.facilityId && mongoose.Types.ObjectId.isValid(body.facilityId)
              ? new mongoose.Types.ObjectId(body.facilityId)
              : null,

          unitId:
            body.unitId && mongoose.Types.ObjectId.isValid(body.unitId)
              ? new mongoose.Types.ObjectId(body.unitId)
              : null,

          customerId:
            body.customerId && mongoose.Types.ObjectId.isValid(body.customerId)
              ? new mongoose.Types.ObjectId(body.customerId)
              : null,

          previousReading,
          currentReading,
          usageDifference,
          maxReading,
          exceededBy,

          valveStatus: body.valveStatus || null,
          statusText: body.statusText || body.status || null,

          voltage:
            body.voltage === undefined || body.voltage === null
              ? null
              : Number(body.voltage),

          pulseConstant: body.pulseConstant || null,
          meteringMode: body.meteringMode || null,
          deviceMeterType: body.deviceMeterType || null,

          lastReadingDate: body.lastReadingDate
            ? new Date(body.lastReadingDate)
            : now,

          meterUpdatedAt: body.meterUpdatedAt
            ? new Date(body.meterUpdatedAt)
            : now,

          lastCheckedAt: now,

          reason:
            body.reason ||
            `Meter usage difference ${usageDifference} has exceeded maximum allowed usage ${maxReading}`,

          rawPayload: body.rawPayload || body,
          status: 'active',
        },
        $setOnInsert: {
          escalatedAt: now,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    return reply.code(200).send({
      success: true,
      message: 'Reading exceeded meter registered successfully',
      data: record,
    });
  } catch (error) {
    console.error('[registerReadingExceededMeter] Failed:', error);

    return reply.code(500).send({
      success: false,
      message: 'Failed to register reading exceeded meter',
      error: error.message,
    });
  }
}

module.exports = {
  createOrUpdateReadingLimit,
  getReadingLimit,
  deleteReadingLimit,
  getReadingExceededMeters,
  deleteReadingExceededMeter,
  registerReadingExceededMeter,

 
  getCachedReadingLimit,
  refreshReadingLimitCache,
};