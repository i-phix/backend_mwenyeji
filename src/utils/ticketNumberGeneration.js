const payservedb = require("payservedb");

const getNextTicketNumber = async (facilityId) => {
  try {
    const counterName = `ticketNumber_${facilityId}`;
    
    // First, try to find existing counter
    let counter = await payservedb.Counter.findOne({
      name: counterName,
      facilityId: facilityId
    });

    if (!counter) {
      // Create new counter starting from 10000
      counter = await payservedb.Counter.create({
        name: counterName,
        facilityId: facilityId,
        sequence: 10000
      });
      return counter.sequence;
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
      return counter.sequence;
    }
  } catch (error) {
    console.error('Error generating ticket number:', error);
    return Math.floor(10000 + Math.random() * 90000);
  }
};

module.exports = { getNextTicketNumber };