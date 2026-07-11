const payservedb = require("payservedb"); // Assuming payservedb is your DB connection
// const sendMessageToQueue = require("../../../../utils/messaging");
const { sendSms } = require('../../../../utils/send_new_sms')
const { getModel } = require("../../../../utils/getModel");

const invite_visitor = async (request, reply) => {
  try {
    const { facilityId, customerId } = request.params;
    const {
      visitingDate,
      visitingDays,
      visitingEndDate,
      unit,
      selectedVisitor,
    } = request.body;

    if (!visitingDate || !visitingEndDate || !unit) {
      return reply
        .status(400)
        .json({ error: "Please fill in all required fields." });
    }

    const visitorModel = await getModel('Visitor', payservedb.Visitor.schema, facilityId);
    const visitLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);

    const visitor = await visitorModel.findById(selectedVisitor._id);
    const customer = await payservedb.Customer.findById(customerId);
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

    const Unit = await unitModel.findById(unit);
    function generateRandomFiveDigitNumber() {
      const randomNumber =
        Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
      return randomNumber;
    }
    const code = generateRandomFiveDigitNumber();
    const visitLog = await visitLogModel.create({
      visitorName: visitor.firstName + " " + visitor.lastName,
      visitorId: selectedVisitor._id,
      residentName: customer && customer.firstName + " " + customer.lastName,
      residentId: customer && customer._id,
      houseNumber: Unit.name,
      entryPoint: "",
      exitPoint: "",
      startTime: new Date(`${visitingDate}`),
      endTime: new Date(`${visitingEndDate}`),
      days: visitingDays,
      status: "Scheduled",
      vehicle: {
        registration: "",
        make: "",
        color: "",
        occupants: "",
      },
      visitationCode: code,
      facilityId: facilityId,
    });

    const visitLogResponse = await visitLog.save();

    const scheduledDate = await formatISODate(new Date(`${visitingDate}`));
    const message = `Greetings, Your visitor invitation code is ${code}. You are scheduled to visit on ${scheduledDate}`;

    sendSms(facilityId, visitor.phoneNumber, message);

    return reply.code(200).send({ message: "Visitor created successfully" });
  } catch (error) {
    return reply.code(500).send({ success: false, error: error.message });
  }
};

const formatISODate = (isoDate) => {
  const date = new Date(isoDate);
  return date.toLocaleString("en-US", {
    weekday: "long", // e.g., Saturday
    year: "numeric", // e.g., 2024
    month: "long", // e.g., September
    day: "numeric", // e.g., 28
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true, // For AM/PM format
    timeZone: "UTC", // Converts time to UTC (you can change this to your preferred time zone)
  });
};

module.exports = invite_visitor;
