const payservedb = require('payservedb');
// const sendMessageToQueue = require('../../../../utils/messaging');
const { sendSms } = require('../../../../utils/send_new_sms')
const { getModel } = require("../../../../utils/getModel");

const edit_visitor = async (request, reply) => {
    try {
        const { facilityId, visitorId } = request.params;
        const { firstName, lastName, phoneNumber, visitingDate } = request.body;

        if (!firstName || !lastName || !phoneNumber) {
            return reply.code(400).send({ error: 'Please fill in all required fields.' });
        }

        const phoneRegex = /^(07\d{8}|254\d{9})$/;
        if (!phoneRegex.test(phoneNumber)) {
            return reply.code(400).send({ error: 'Phone number must be in the format "0712345678" or "254712345678".' });
        }

        const filteredPhoneNumber = phoneNumber.slice(-9);

        const visitorModel = await getModel('Visitor', payservedb.Visitor.schema, facilityId);

        // Check if the visitor exists
        const visitor = await visitorModel.findById(visitorId);
        if (!visitor) {
            return reply.code(404).send({ error: 'Visitor not found.' });
        }

        // Update visitor fields
        visitor.firstName = firstName;
        visitor.lastName = lastName;
        visitor.phoneNumber = filteredPhoneNumber;

        if (visitingDate) {
            visitor.invitationDate = formatDateToMonthDayYear(new Date(visitingDate));
        }

        // Save updated visitor to the database
        const updatedVisitor = await visitor.save();

        // Optionally, send updated invitation message if visitingDate is provided
        if (visitingDate) {
            const scheduledDate = formatDateToMonthDayYear(new Date(visitingDate));
            const message = `Hello ${firstName}, your updated visitation date is ${scheduledDate}.`;
            sendSms(facilityId, filteredPhoneNumber, message);
        }

        return reply.code(200).send({ message: 'Visitor updated successfully', visitor: updatedVisitor });

    } catch (error) {
        return reply.code(500).send({ success: false, error: error.message });
    }
};

// Utility function to format date
function formatDateToMonthDayYear(dateInput) {
    const date = new Date(dateInput);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

module.exports = edit_visitor;
