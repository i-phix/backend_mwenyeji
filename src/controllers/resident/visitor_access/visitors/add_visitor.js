const payservedb = require('payservedb');
const { sendSms } = require('../../../../utils/send_new_sms')
const { getModel } = require("../../../../utils/getModel");

const add_visitor = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params;
        const { firstName, lastName, phoneNumber, visitingDate, unit, invitationCode, userType } = request.body

        if (!firstName || !lastName || !phoneNumber) {
            return reply.code(400).send({ error: 'Please fill in all required fields.' });
        }

        const filteredPhoneNumber = phoneNumber.slice(-9);

        let customer = null
        if (customerId !== undefined) {
            customer = await payservedb.Customer.findById(customerId)
        }
        else {
            let user = await payservedb.User.findById(customerId);
            if (user) {
                const customerData = user.customerData;
                if (customerData.length > 0) {
                    const customerId = customerData[0].customerId
                    customer = await payservedb.Customer.findById(customerId)


                }
            }
        }

        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        const visitorModel = await getModel('Visitor', payservedb.Visitor.schema, facilityId);

        const newVisitor = await visitorModel.create({
            firstName: firstName,
            lastName: lastName,
            phoneNumber: filteredPhoneNumber,
            facilityId: facilityId,
            residentId: customerId,
            invited: invitationCode ? true : false,
            invitationDate: invitationCode ? await formatDateToMonthDayYear(new Date(`${visitingDate}`)) : ''
        });

        const response = await newVisitor.save();

        const visitLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);

        if (invitationCode) {

            function generateRandomFiveDigitNumber() {
                const randomNumber = Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
                return randomNumber;
            }
            const code = generateRandomFiveDigitNumber();
            const Unit = await unitModel.findById(unit);
            const visitLog = await visitLogModel.create({
                visitorName: firstName + ' ' + lastName,
                visitorId: response._id,
                residentName: customer && customer.firstName + ' ' + customer.lastName,
                residentId: customer && customer._id,
                userId: customerId,
                phoneNumber: filteredPhoneNumber,
                houseNumber: Unit.name,
                division: Unit.division,
                entryPoint: "",
                exitPoint: "",
                // startTime: new Date(`${visitingDate}`),
                startTime: new Date(),
                endTime: "",
                status: "Scheduled",
                vehicle: {
                    registration: "",
                    make: "",
                    color: "",
                    occupants: "",
                },
                visitationCode: code,
                facilityId: facilityId
            })

            const visitLogResponse = await visitLog.save()
            const scheduledDate = await formatDateToMonthDayYear(new Date(`${visitingDate}`))

            const message = `You have been sent a code to access ${Unit.name} within Payserve Estate.  Please give the following code at the gate: ${code}. It is only valid on ${scheduledDate}`

            sendSms(facilityId, phoneNumber, message);
        }
        return reply.code(200).send({ message: 'Visitor created successfully' });


    } catch (error) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}



function formatDateToMonthDayYear(dateInput) {
    const date = new Date(dateInput);

    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

module.exports = add_visitor;
