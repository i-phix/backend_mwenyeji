const payservedb = require('payservedb');

const edit_family_member = async (request, reply) => {
    try {
        const { customerId, familyId } = request.params; // Extract parameters from request
        const { fullName, relation, email, phoneNumber } = request.body; // Extract editable fields

        // Fetch customer by ID
        const customer = await payservedb.Customer.findById(customerId);

        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found.' });
        }

        // Find the family member to update
        const familyMember = customer.familyMembers.id(familyId);

        if (!familyMember) {
            return reply.code(404).send({ error: 'Family member not found.' });
        }

        const phoneNumberRegex = /^(07\d{8}|254\d{9}|7\d{8})$/;

        if (!phoneNumberRegex.test(phoneNumber)) {
            return reply.code(400).send({ error: 'Please enter a valid phone number in the format "0712345678", "254712345678", or "712345678".' });
        }

        // If the phone number is valid, filter it to keep the last 9 digits
        const filteredPhoneNumber = phoneNumber.replace(/^(0|254)?/, '');

        // Update family member's details only if a new value is provided
        familyMember.name = fullName || familyMember.name;
        familyMember.relation = relation || familyMember.relation;
        familyMember.email = email || familyMember.email;
        familyMember.phoneNumber = filteredPhoneNumber || familyMember.phoneNumber;

        // Save the updated customer document
        await customer.save();

        return reply.code(200).send('Family member updated successfully.');
    } catch (err) {
        console.error('Error editing family member:', err.message); // Log error for debugging
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = edit_family_member;
