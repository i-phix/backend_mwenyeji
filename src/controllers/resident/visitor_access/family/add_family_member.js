const payservedb = require('payservedb');
const bcrypt = require('bcryptjs');
const { sendSms } = require('../../../../utils/send_new_sms')
const { sendEmail } = require("../../../../utils/send_new_email");

const add_family_members = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params;
        const { fullName, phoneNumber,email,  relation,visitorQRCode, uniqueCode,addVisitor,receiveMessage, status, unit } = request.body;

        // Validate input
        if (!fullName || !phoneNumber || !relation) {
            return reply.code(400).send({ error: 'All fields are required.' });
        }

        const customer = await payservedb.Customer.findById(customerId);
        
        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found.' });
        }

        const generateRandomNumber = () => {
            return Math.floor(Math.random() * (1000000 - 10000)) + 10000;
        };
        const filteredPhoneNumber = phoneNumber.slice(-9);
        // Create a new family member entry
        const newFamilyMember = {
            no: generateRandomNumber(),
            name:fullName,
            phoneNumber:filteredPhoneNumber,
            email,
            relation,
            qrCode:visitorQRCode,
            qrUniqueCode:uniqueCode,
            disabled: false,
            addVisitor,
            receiveMessage,
            unit,
            status: status || "Active"
        };

        // Add family member to the customer's familyMembers array
        customer.familyMembers.push(newFamilyMember);

        // Save the updated customer document
        await customer.save();
        if (addVisitor) {
            const filterUser = await payservedb.User.findOne({ email });
            if (filterUser) {
                const query = {
                    _id: filterUser._id
                }
                let customerData = filterUser.customerData
                customerData.push({
                    facilityId: customer.facilityId,
                    customerId: customer._id,
                    isEnabled:true
                })
                let data = {
                    customerData
                }
                await payservedb.User.updateOne(query, data)

            }
            else {
              
                const password = 'PXDS' + generateRandomNumber()
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                const dataUser = new payservedb.User({
                    fullName: fullName,
                    email: email,
                    phoneNumber: filteredPhoneNumber,
                    idNumber: '00000',
                    type: "Resident",
                    role: "family",
                    kyc: {},
                    companies: [],
                    customerData: [
                        {
                            facilityId: customer.facilityId,
                            customerId: customer._id,
                            isEnabled:true
                        }
                    ],
                    password: hashedPassword
                })
                const responseUser = await dataUser.save();
            

                message = `LOGIN CREDENTIALS, Dear resident, please login to ${process.env.residentFrontEndUrl}\nLogin Credentials:\nUsername: ${email},\nPassword: ${password}`

                sendSms(facilityId, responseUser.phoneNumber, message);
                sendEmail(facilityId, responseUser.email, 'PAYSERVE LOGIN CREDENTIALS', message);
            }

        }

        return reply.code(200).send('Family member added to customer successfully.' );

    } catch (err) {
        console.error('Error adding family member to customer:', err.message); // Log error for debugging
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_family_members

