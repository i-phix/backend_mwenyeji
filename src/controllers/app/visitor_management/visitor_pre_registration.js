const payservedb = require("payservedb");
const { sendSms } = require("../../../utils/send_new_sms");
const { sendEmail } = require("../../../utils/send_new_email");
const checkDistance = require("../../../utils/checkDistance");
const { getModel } = require("../../../utils/getModel");

const visitor_pre_registration = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      firstName,
      lastName,
      phoneNumber,
      idNumber,
      houseId,
      division,
      confirmVisit,
      guardId,
      entryPointId,
      lat,
      long,
    } = request.body;

    const check_distance = await checkDistance(long, lat, entryPointId);

    // if (!check_distance) {
    //   throw new Error("You are far away from the entry point");
    // }

    if (!firstName || !lastName || !phoneNumber) {
      return reply
        .code(400)
        .json({ error: "Please fill in all required fields." });
    }

    let customer = null;
    let houseNumber = null;
    //  if (resident !== undefined) {
    const unitModel = await getModel(
      "Unit",
      payservedb.Unit.schema,
      facilityId,
    );
    const unitExist = await unitModel.findById(houseId);
    if (unitExist) {
      houseNumber = unitExist.name;
      customer = await payservedb.Customer.findById(unitExist.residentId);
    }

    //}

    const filteredPhoneNumber = phoneNumber.slice(-9);

    const visitorModel = await getModel(
      "Visitor",
      payservedb.Visitor.schema,
      facilityId,
    );

    const newVisitor = await visitorModel.create({
      firstName: firstName,
      lastName: lastName,
      phoneNumber: filteredPhoneNumber,
      idNumber: idNumber,
      status: "Waiting List",
      facilityId: facilityId,
      residentId: customer && customer._id,
    });

    const response = await newVisitor.save();

    const visitLogModel = await getModel(
      "VisitLog",
      payservedb.VisitLog.schema,
      facilityId,
    );

    if (confirmVisit) {
      const visitLog = await visitLogModel.create({
        visitorName: firstName + " " + lastName,
        visitorId: response._id,
        residentName: customer && customer.firstName + " " + customer.lastName,
        residentId: customer && customer._id,
        division,
        houseNumber,
        division: division,
        entryPoint: "",
        guardId: guardId,
        exitPoint: "",
        startTime: new Date(),
        endTime: "",
        status: "Visit Confirmation",
        // vehicle: {
        //     registration: carRegistration,
        //     make: carMake,
        //     color: carColor,
        //     occupants: carOccupants,
        // },
        facilityId: facilityId,
      });
      const visitLogResponse = await visitLog.save();

      const residentPhoneNumber = customer && customer.phoneNumber;
      const residentEmail = customer && customer.email;
      // let familyMembers = customer && customer.familyMembers.filter((x) => {
      //     return x.receiveMessage === true
      // })
      let familyMembers =
        customer && customer.familyMembers
          ? customer.familyMembers.filter((x) => {
            return x.receiveMessage === true;
          })
          : [];
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
    }

    return reply.code(200).send({ message: "Visitor created successfully" });
  } catch (err) {
    console.error("error message............", "err");
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = visitor_pre_registration;
