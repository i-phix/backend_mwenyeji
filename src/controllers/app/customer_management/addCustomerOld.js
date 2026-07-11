const payservedb = require('payservedb');
const bcrypt = require('bcryptjs');
const sendMessageToQueue = require('../../../utils/messaging')
const { getModel } = require('../../../utils/getModel');

const add_customer = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            firstName,
            lastName,
            email,
            phoneNumber,
            idNumber,
            nextOfKinName,
            nextOfKinRelationship,
            nextOfKinContact,
            units,
            customerType,
            residentType,
        } = request.body;

        const generateRandomNumber = () => Math.floor(Math.random() * (1000000 - 10000)) + 10000;

        const filteredPhoneNumber = phoneNumber.trim().slice(-9);

        const existingCustomer = await payservedb.Customer.findOne({ phoneNumber: filteredPhoneNumber });
        if (existingCustomer) {
            return reply.code(400).send({ error: 'A customer with this phone number already exists.' });
        }

        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        for (let unit of units) {
            const existingUnit = await unitModel.findOne({ _id: unit._id });

            if (!existingUnit) {
                return reply.code(400).send({ error: `Unit ${unit.name} does not exist.` });
            }

            if (existingUnit.homeOwnerId && existingUnit.tenantId) {
                return reply
                    .code(400)
                    .send({ error: `Unit ${unit.name} is already occupied by both a homeowner and a tenant.` });
            }

            if (customerType === "home owner") {
                if (existingUnit.homeOwnerId) {
                    return reply
                        .code(400)
                        .send({ error: `Unit ${unit.name} is already assigned to a homeowner.` });
                }
                if (existingUnit.tenantId) {
                    if (residentType === "resident") {
                        return reply
                            .code(400)
                            .send({ error: `Unit ${unit.name} already has a tenant. Homeowner cannot be a Resident.` });
                    }
                    request.body.residentType = "non-resident"; // Auto-set residentType to non-resident if tenant exists
                }
            }

            if (customerType === "tenant" && existingUnit.tenantId) {
                return reply
                    .code(400)
                    .send({ error: `Unit ${unit.name} is already assigned to a tenant.` });
            }
        }

        const fullName = `${firstName} ${lastName}`;
        const customerNumber = generateRandomNumber();

        const data = new payservedb.Customer({
            customerNumber,
            firstName,
            lastName,
            email,
            phoneNumber: filteredPhoneNumber,
            idNumber,
            nextOfKinName,
            nextOfKinRelationship,
            nextOfKinContact,
            customerType,
            residentType,
            facilityId,
            status: "Active",
        });

        const response = await data.save();

        // Add a new user
        const filterUser = await payservedb.User.findOne({ email });

        if (filterUser) {
            const query = { _id: filterUser._id };
            let customerData = filterUser.customerData;

            customerData.push({
                facilityId,
                customerId: response._id,
                isEnabled: true,
            });

            let updateData = { customerData };
            await payservedb.User.updateOne(query, updateData);
        } else {
            const password = 'PXDS' + customerNumber;
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            let userType = residentType === "resident" ? "Resident" : "Landlord"; // Ensure non-resident homeowners are "Landlord"

            const dataUser = new payservedb.User({
                fullName,
                email,
                phoneNumber: filteredPhoneNumber,
                idNumber,
                type: userType,
                role: "admin",
                kyc: {},
                companies: [],
                customerData: [
                    {
                        facilityId,
                        customerId: response._id,
                        isEnabled: true,
                    },
                ],
                password: hashedPassword,
            });

            const responseUser = await dataUser.save();

            // Send login credentials via email & SMS
            sendMessageToQueue("PayServe", responseUser.email, 'PayServe LOGIN CREDENTIALS', `Dear ${userType}, please login to ${process.env.residentFrontEndUrl}\nUsername: ${email},\nPassword: ${password}\nReset your password here: \nhttps://resident.payserve.co.ke/reset_password/${responseUser._id}`, 'Email');

            sendMessageToQueue("PayServe", responseUser.phoneNumber, 'PayServe LOGIN CREDENTIALS', `Dear ${userType}, please login to ${process.env.residentFrontEndUrl}\nUsername: ${email},\nPassword: ${password}\nReset your password here: \nhttps://resident.payserve.co.ke/reset_password/${responseUser._id}`, 'SMS Meliora');
        }


        if (units.length > 0) {
            for (let unit of units) {
                const query = { _id: unit._id };
                const data = {};

                if (customerType === 'home owner') {
                    data.homeOwnerId = response._id;
                } else if (customerType === 'tenant') {
                    data.tenantId = response._id;
                }

                // Assign residentId only if they are a resident
                if (customerType === 'tenant' || residentType === 'resident') {
                    data.residentId = response._id;
                }

                await unitModel.updateOne(query, data);
            }
        }


        return reply.code(200).send('Customer added successfully');
    } catch (err) {
        console.log(err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_customer;
