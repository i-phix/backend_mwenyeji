const payservedb = require("payservedb");

const getNextServiceRequestNumber = async (facilityId) => {
  try {
    const counterName = `serviceRequestNumber_${facilityId}`;
    
    // First, try to find existing counter
    let counter = await payservedb.Counter.findOne({
      name: counterName,
      facilityId: facilityId
    });

    if (!counter) {
      // Create new counter starting from 1000 (you can adjust this)
      counter = await payservedb.Counter.create({
        name: counterName,
        facilityId: facilityId,
        sequence: 1000
      });
      return `#SR${counter.sequence}`;
    } else {
      // Increment existing counter
      counter = await payservedb.Counter.findOneAndUpdate(
        { 
          name: counterName,
          facilityId: facilityId 
        },
        { $inc: { sequence: 1 } },
        { new: true }
      );
      return `SR${counter.sequence}`;
    }
  } catch (error) {
    console.error('Error generating service request number:', error);
    // Fallback to timestamp-based number
    return `SR${Date.now()}`;
  }
};

module.exports = { getNextServiceRequestNumber };