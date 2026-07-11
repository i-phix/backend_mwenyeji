const mongoose = require('mongoose');
const { getModel } = require('../../../../../../utils/database2');

const DATABASE_NAME = 'utility_database';

const EscalatedMeterSchema = new mongoose.Schema(
  {
    meterId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
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

async function getEscalatedMeters(request, reply) {
  try {
    const EscalatedMeter = await getModel(
      DATABASE_NAME,
      'EscalatedMeter',
      EscalatedMeterSchema
    );

    const {
      page = 1,
      limit = 20,
      search = '',
      protocol,
      facilityId,
      unitId,
      status = 'active',
      sortBy = 'escalatedAt',
      sortOrder = 'desc',
    } = request.query || {};

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (pageNumber - 1) * limitNumber;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (protocol) {
      query.protocol = protocol;
    }

    if (facilityId && mongoose.Types.ObjectId.isValid(facilityId)) {
      query.facilityId = new mongoose.Types.ObjectId(facilityId);
    }

    if (unitId && mongoose.Types.ObjectId.isValid(unitId)) {
      query.unitId = new mongoose.Types.ObjectId(unitId);
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');

      query.$or = [
        { accountNumber: searchRegex },
        { protocol: searchRegex },
        { manufacturer: searchRegex },
        { meterType: searchRegex },
        { size: searchRegex },
        { concentratorSerialNumber: searchRegex },
        { reason: searchRegex },
      ];

      if (mongoose.Types.ObjectId.isValid(search.trim())) {
        query.$or.push({
          meterId: new mongoose.Types.ObjectId(search.trim()),
        });
      }
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const allowedSortFields = [
      'accountNumber',
      'protocol',
      'lastReadingDate',
      'meterUpdatedAt',
      'escalatedAt',
      'lastCheckedAt',
      'createdAt',
      'updatedAt',
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'escalatedAt';

    const [records, totalRecords] = await Promise.all([
      EscalatedMeter.find(query)
        .sort({ [safeSortBy]: sortDirection })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      EscalatedMeter.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalRecords / limitNumber);

    return reply.code(200).send({
      success: true,
      message: 'Escalated meters fetched successfully',
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
    console.error('[getEscalatedMeters] Failed:', error.message);
    console.error(error);

    return reply.code(500).send({
      success: false,
      message: 'Failed to fetch escalated meters',
      error: error.message,
    });
  }
}

module.exports = getEscalatedMeters;