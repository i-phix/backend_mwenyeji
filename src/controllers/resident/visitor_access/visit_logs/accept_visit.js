const payservedb = require("payservedb");
// const sendMessageToQueue = require("../../../../utils/messaging");
const { sendSms } = require('../../../../utils/send_new_sms');
const accept_visit = async (request, reply) => {
  try {
    let { visitLogId } = request.params;
    let query = {
      _id: visitLogId,
    };
    let data = {
      status: "Checked In",
      startTime: new Date(),
    };

    await payservedb.VisitLog.updateOne(query, data);
    const visitLog = await payservedb.VisitLog.findById(visitLogId);
    if (visitLog) {
      if (visitLog.requestedBy !== undefined) {
        const userExist = await payservedb.User.findById(visitLog.requestedBy);
        if (userExist) {
          let message = `The visit confirmation for ${visitLog.visitorName} has been successfully accepted.`;
          sendSms(facilityId, userExist.phoneNumber, message);
          // sendMessageToQueue(
          //   "Payserve",
          //   userExist.phoneNumber,
          //   "",
          //   message,
          //   "SMS Meliora"
          // );
        }
      }
    }
    return reply.code(200).send("Accepted successfully");
  } catch (err) {
    return reply.code(502).send(err.message);
  }
};
module.exports = accept_visit;
