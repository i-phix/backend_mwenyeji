const payservedb = require("payservedb");
const { sendSms } = require("../../../utils/send_new_sms");
const { sendEmail } = require("../../../utils/send_new_email");
const { getModel } = require("../../../utils/getModel");

const visitor_pre_registration = async (request, reply) => {
  try {
    const { userId } = request.user;
    const {
      resident,
      houseId,
      carRegistration,
      carColor,
      carMake,
      carOccupants,
      visitor,
      entry,
    } = request.body;

    let customer = null;
    let houseNumber = null;

    const unitModel = await getModel(
      "Unit",
      payservedb.Unit.schema,
      visitor.facilityId,
    );
    const unitExist = await unitModel.findById(houseId);

    if (unitExist) {
      houseNumber = unitExist.name;
      customer = await payservedb.Customer.findById(unitExist.residentId);
    }

    const visitorModel = await getModel(
      "Visitor",
      payservedb.Visitor.schema,
      visitor.facilityId,
    );
    const visitorExist = await visitorModel.findById(visitor._id);

    const visitLogModel = await getModel(
      "VisitLog",
      payservedb.VisitLog.schema,
      visitor.facilityId,
    );

    const visitLog = await visitLogModel.create({
      visitorName: visitorExist.firstName + " " + visitorExist.lastName,
      visitorId: visitorExist._id,
      residentName: customer && customer.firstName + " " + customer.lastName,
      residentId: customer._id,
      houseNumber: houseNumber,
      startTime: new Date(),
      entryPoint: entry,
      endTime: "",
      status: "Visit Confirmation",
      vehicle: {
        registration: carRegistration,
        make: carMake,
        color: carColor,
        occupants: carOccupants,
      },
      requestedBy: userId,
      facilityId: visitorExist.facilityId,
    });

    const visitLogResponse = await visitLog.save();
    const residentPhoneNumber = customer && customer.phoneNumber;
    const residentEmail = customer && customer.email;

    let familyMembers =
      customer &&
      customer.familyMembers.filter((x) => {
        return x.receiveMessage === true;
      });

    if (residentPhoneNumber !== undefined || residentEmail !== undefined) {
      const approvalLink =
        `${process.env.residentFrontEndUrl}/va/dlql/` + visitLogResponse._id;
      const message = `Greetings, A visitor is requesting entry. Click the link to approve or deny visit: ${approvalLink}`;

      sendSms(facilityId, residentPhoneNumber, message);
      sendEmail(facilityId, residentEmail, 'Visitor Confirmation', message);

      // sendMessageToQueue(
      //   "Payserve",
      //   residentPhoneNumber,
      //   "",
      //   message,
      //   "SMS Meliora",
      // );
      // sendMessageToQueue(
      //   "Payserve",
      //   residentEmail,
      //   "Visitor Confirmation",
      //   message,
      //   "Email",
      // );
      if (familyMembers.length > 0) {
        familyMembers.map(async (family) => {
          const residentPhoneNumber = family.phoneNumber;
          const residentEmail = family.email;

          const approvalLink =
            `${process.env.residentFrontEndUrl}/va/dlql/` +
            visitLogResponse._id;
          const message = `Greetings, A visitor is requesting entry. Click the link to approve or deny visit: ${approvalLink}`;

          sendSms(facilityId, residentPhoneNumber, message);
          sendEmail(facilityId, residentEmail, 'Visitor Confirmation', message);


          // sendMessageToQueue(
          //   "Payserve",
          //   residentPhoneNumber,
          //   "",
          //   message,
          //   "SMS Meliora",
          // );
          // sendMessageToQueue(
          //   "Payserve",
          //   residentEmail,
          //   "Visitor Confirmation",
          //   message,
          //   "Email",
          // );
        });
      }
    }

    // Send approval link via SMS to resident

    console.log(55555);
    return reply.code(200).send({ message: "Visitor created successfully" });
  } catch (err) {
    console.error("error message............", "err");
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = visitor_pre_registration;
