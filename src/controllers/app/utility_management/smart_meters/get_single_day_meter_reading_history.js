const { ObjectId } = require('mongoose').Types;
const utilityDb = require('../../../../middlewares/utilityDb');

const getSingleDayWaterMeterReadings = async (request, reply) => {
  try {
    const { meterId } = request.params;
    const { date, page = 1, limit = 50 } = request.query;

    if (!meterId) {
      return reply.code(400).send({
        success: false,
        error: 'meterId is required'
      });
    }

    if (!date) {
      return reply.code(400).send({
        success: false,
        error: 'Date is required in YYYY-MM-DD format'
      });
    }

    // Parse the date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid date format. Please use YYYY-MM-DD.'
      });
    }

    const formattedDate = parsedDate.toISOString().split('T')[0];

    const SingleDayModel = await utilityDb.getModel('SingleDayWaterMeterHistory');

    const query = {
      meterId: new ObjectId(meterId),
      date: formattedDate
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const total = await SingleDayModel.countDocuments(query);

    const results = await SingleDayModel.find(query)
      .sort({ time: 1 }) ;

    const readings = results.map(r => ({
      id: r._id,
      reading: r.reading,
      time: r.time,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    return reply.code(200).send({
      success: true,
      data: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        readings
      }
    });
  } catch (error) {
    console.error('Error fetching single-day readings:', error);
    return reply.code(502).send({
      success: false,
      error: error.message
    });
  }
};

module.exports = getSingleDayWaterMeterReadings;
