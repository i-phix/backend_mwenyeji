const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const addCommonAreaElectricityReading = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { 
      date, 
      location, 
      openingReadingKWh, 
      closingReadingKWh, 
      consumptionKWh
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

    const commonAreaElectricityReadingModel = await getModel(
      "CommonAreaElectricityReading",
      payservedb.CommonAreaElectricityReading.schema,
      facilityId
    );

    // Check if a reading already exists for the given date and location
    const existingReading = await commonAreaElectricityReadingModel.findOne({
      facilityId,
      date,
      location
    });

    // If reading exists for this date and location, return an error
    if (existingReading) {
      return reply.code(409).send({
        error: `An electricity reading for location "${location}" already exists for this date. Only one entry per location is allowed per day.`
      });
    }

    // If no existing reading for this date and location, proceed to create a new one
    const savedReading = await commonAreaElectricityReadingModel.create({
      facilityId,
      date,
      location,
      openingReadingKWh,
      closingReadingKWh,
      consumptionKWh
    });

    return reply.code(200).send({
      message: "Common Area Electricity Reading added successfully",
      reading: savedReading,
    });
  } catch (err) {
    console.error("Error in addCommonAreaElectricityReading:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addCommonAreaElectricityReading;