const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const DeliveryRegistration = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { firstName, lastName, phoneNumber, idNumber, houseNumber } = request.body;

        if (!firstName) throw new Error('First name is required.');
        if (!lastName) throw new Error('Last name is required.');
        if (!phoneNumber) throw new Error('Phone number is required.');
        if (!idNumber) throw new Error('ID number is required.');
        if (!houseNumber) throw new Error('House number is required.');

        // Trim spaces from the phone number
        const trimmedPhoneNumber = phoneNumber.trim();

        // Validate the phone number format based on length and prefix
        if (
            (trimmedPhoneNumber.startsWith('07') || trimmedPhoneNumber.startsWith('01')) &&
            trimmedPhoneNumber.length !== 10
        ) {
            throw new Error('Invalid phone number format. Numbers starting with 07 or 01 must have exactly 10 digits.');
        }

        if (trimmedPhoneNumber.startsWith('254') && trimmedPhoneNumber.length !== 12) {
            throw new Error('Invalid phone number format. Numbers starting with 254 must have exactly 12 digits.');
        }

        // Extract the last 9 digits
        const lastNineDigits = trimmedPhoneNumber.slice(-9);

        // Validate the extracted 9 digits
        if (!/^\d{9}$/.test(lastNineDigits)) {
            throw new Error('Invalid phone number. Ensure the number contains exactly 9 digits after processing.');
        }

        const visitorModel = await getModel('Visitor', payservedb.Visitor.schema, facilityId);

        // Create a new visitor record
        const newVisitor = await visitorModel.create({
            firstName,
            lastName,
            idNumber,
            phoneNumber: lastNineDigits, // Save only the last 9 digits
            status: "Checked In",
            facilityId,
        });

        const visitorResponse = await newVisitor.save();

        const visitLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);


        // Add the visitor to the visit log
        const visitLog = await visitLogModel.create({
            visitorName: `${firstName} ${lastName}`,
            visitorId: visitorResponse._id,
            houseNumber,
            division: '', // Optional field, left empty
            entryPoint: '', // Optional field, left empty
            exitPoint: '', // Optional field, left empty
            startTime: new Date(),
            endTime: '', // Optional
            status: "Checked In",
            facilityId,
        });

        await visitLog.save();

        // Return a success response
        return reply.code(200).send({ message: 'Delivery registered successfully.' });

    } catch (err) {
        console.error('Error registering delivery:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = DeliveryRegistration;