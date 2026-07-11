const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const addCommonAreaWaterReading = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { 
      date, 
      sourceType, 
      openingReadingM3, 
      closingReadingM3, 
      consumptionM3
    } = request.body;

    // Validate the date is not in the future
    const inputDate = new Date(date);
    const currentDate = new Date();
    
    // Check if input date is valid
    if (isNaN(inputDate.getTime())) {
      return reply.code(400).send({
        error: "Invalid date format. Please use YYYY-MM-DD format."
      });
    }
    
    // Convert both dates to YYYY-MM-DD format for comparison
    const inputDateString = inputDate.toISOString().split('T')[0];
    const currentDateString = currentDate.toISOString().split('T')[0];
    
    // Compare the date strings directly
    if (inputDateString > currentDateString) {
      return reply.code(400).send({
        error: "Future dates are not allowed. Please provide current or past date."
      });
    }

    const commonAreaWaterReadingModel = await getModel(
      "CommonAreaWaterReading",
      payservedb.CommonAreaWaterReading.schema,
      facilityId
    );

    // Check if a reading already exists for the given date and sourceType
    const existingReading = await commonAreaWaterReadingModel.findOne({
      facilityId,
      date,
      sourceType
    });

    // If reading exists for this date and sourceType, return an error
    if (existingReading) {
      return reply.code(409).send({
        error: `A reading for ${sourceType} source already exists for this date. Only one entry per source type is allowed per day.`
      });
    }

    // If no existing reading for this date and sourceType, proceed to create a new one
    const savedReading = await commonAreaWaterReadingModel.create({
      facilityId,
      date,
      sourceType,
      openingReadingM3,
      closingReadingM3,
      consumptionM3
    });

    return reply.code(200).send({
      message: "Common Area Water Reading added successfully",
      reading: savedReading,
    });
  } catch (err) {
    console.error("Error in addCommonAreaWaterReading:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addCommonAreaWaterReading;