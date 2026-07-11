const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const addCommonAreaGeneratorReading = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      date,
      openingReading,         
      closingReading,         
      totalHrsRun,
      totalFuelLevelFraction, 
      totalFuelLevelLiters,   
      refillAmountLiters
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

    const commonAreaGeneratorReadingModel = await getModel(
      "CommonAreaGeneratorReading",
      payservedb.CommonAreaGeneratorReading.schema,
      facilityId
    );

    // Check if a reading already exists for the given date
    const existingReading = await commonAreaGeneratorReadingModel.findOne({
      facilityId,
      date
    });

    // If reading exists for this date, return an error
    if (existingReading) {
      return reply.code(409).send({
        error: "A reading already exists for this date. Cannot add duplicate readings."
      });
    }

    // If no existing reading, proceed to create a new one
    const savedReading = await commonAreaGeneratorReadingModel.create({
      facilityId,
      date,
      openingReading,        
      closingReading,         
      totalHrsRun,
      totalFuelLevelFraction, 
      totalFuelLevelLiters,   
      refillAmountLiters
    });

    return reply.code(200).send({
      success: true,
      message: "Common Area Generator Reading added successfully",
      reading: savedReading,
    });
  } catch (err) {
    console.error("Error in addCommonAreaGeneratorReading:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addCommonAreaGeneratorReading;