const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const getCommonAreaAlerts = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { date, status } = request.query;
    
    // Create query object
    const query = { facilityId };
    
    // Add filters if provided
    if (date) {
      // Format date to match date format in database
      const queryDate = new Date(date);
      // Set time to 00:00:00 for the start of the day
      queryDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(queryDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query.date = {
        $gte: queryDate,
        $lt: nextDay
      };
    }
    
    if (status) {
      query.status = status;
    }
    
    const alertModel = await getModel(
      "CommonAreaUtilityAlert",
      payservedb.CommonAreaUtilityAlert.schema,
      facilityId
    );

    const alerts = await alertModel.find(query).sort({ date: -1 });

    return reply.code(200).send({
      success: true,
      data: {
        alerts
      }
    });
  } catch (err) {
    console.error("Error in getCommonAreaAlerts:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = getCommonAreaAlerts;