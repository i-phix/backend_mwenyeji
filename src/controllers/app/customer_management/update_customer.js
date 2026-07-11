const payservedb = require('payservedb');

const update_customer = async (request, reply) => {
    try {
        const { customerId } = request.params;
        let { firstName, lastName, phoneNumber, email, idNumber, kraPin } = request.body;

        // --- PHONE VALIDATION ---
        if (phoneNumber) {
            const cleaned = phoneNumber.replace(/\D/g, '');

            // Case 0: already normalized (9 digits starting with 7 or 1)
            if (
                cleaned.length === 9 &&
                (cleaned.startsWith('7') || cleaned.startsWith('1'))
            ) {
                phoneNumber = cleaned;
            }
            // Case 1: starts with 07 or 01 → must be 10 digits
            else if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
                if (cleaned.length !== 10) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Phone starting with 07 or 01 must have exactly 10 digits'
                    });
                }
                phoneNumber = cleaned.slice(-9);
            } 
            // Case 2: starts with 254 → max 12 digits
            else if (cleaned.startsWith('254')) {
                if (cleaned.length > 12) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Phone starting with 254 must not exceed 12 digits'
                    });
                }
                phoneNumber = cleaned.slice(-9);
            } 
            else {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid phone number format'
                });
            }
        }

        // --- EMAIL VALIDATION ---
        if (email) {
            email = email.trim().toLowerCase();

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(email)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid email format'
                });
            }
        }

        const customerData = {
            firstName,
            lastName,
            phoneNumber,
            email,
            idNumber,
            kraPin: kraPin ? kraPin.trim().toUpperCase() : null,
        };

        await payservedb.Customer.updateOne(
            { _id: customerId },
            { $set: customerData }
        );

        const fullName = `${firstName} ${lastName}`;

        await payservedb.User.updateOne(
            { 'customerData.customerId': customerId },
            {
                $set: {
                    fullName,
                    email,
                    phoneNumber,
                    idNumber
                }
            }
        );

        return reply.code(200).send({
            success: true,
            message: 'Customer updated successfully'
        });

    } catch (err) {
        console.error('Error updating customer and user records:', err);

        return reply.code(400).send({
            success: false,
            message: err.message
        });
    }
};

module.exports = update_customer;