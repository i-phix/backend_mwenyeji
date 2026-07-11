const payservedb = require('payservedb');
const bcrypt = require('bcryptjs');
const { sendSms } = require('../../../utils/send_new_sms')
const { sendEmail } = require("../../../utils/send_new_email");

const add_user = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { userId } = request.user;

        const {
            firstName,
            lastName,
            email,
            phoneNumber,
            department, // This should now be a FacilityDepartment ObjectId
            permissions
        } = request.body;

        const filteredPhoneNumber = phoneNumber.trim().slice(-9);

        // Validate that the department exists and belongs to this facility (using tenant-specific model)
        if (department) {
            const { getModel } = require('../../../utils/getModel');
            const departmentModel = await getModel('FacilityDepartment', payservedb.FacilityDepartment.schema, facilityId);

            const departmentExists = await departmentModel.findOne({
                _id: department,
                facilityId: facilityId
            });

            if (!departmentExists) {
                return reply.code(400).send({ error: 'Invalid department. Department does not exist in this facility.' });
            }
        }

        // Check if customer already exists in THIS facility
        const existingUserInFacility = await payservedb.User.findOne({
            phoneNumber: filteredPhoneNumber,
            facilityId: facilityId
        });

        if (existingUserInFacility) {
            return reply.code(400).send({ error: 'A user with this phone number already exists in this facility.' });
        }

        const userExist = await payservedb.User.findById(userId);

        const fullName = `${firstName} ${lastName}`;

        const password = 'PXDS' + Math.floor(1000 + Math.random() * 9000); // Generate a random password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const dataUser = new payservedb.User({
            fullName,
            email,
            phoneNumber: filteredPhoneNumber,
            type: 'Company',
            role: 'Staff',
            department, // Now expects ObjectId reference to FacilityDepartment
            kyc: {},
            companies: userExist ? userExist.companies : [],
            permissions,
            password: hashedPassword,
            facilityId: facilityId,
        });

        const responseUser = await dataUser.save();

        const message = `PayServe LOGIN CREDENTIALS: 
        Dear ${fullName}, please login to ${process.env.appFrontEndUrl}\nUsername: ${email},\nPassword: ${password}\nReset your password here: \nhttps://app.payserve.co.ke/reset_password/${responseUser._id}`;

        sendSms(facilityId, responseUser.phoneNumber, message);
        sendEmail(facilityId, responseUser.email, 'PAYSERVE LOGIN CREDENTIALS', message);

        return reply.code(200).send({
            success: true,
            message: 'User created successfully',
            user: {
                id: responseUser._id,
                fullName: responseUser.fullName,
                email: responseUser.email,
                phoneNumber: responseUser.phoneNumber,
                department: responseUser.department
            }
        });
    }
    catch (err) {
        console.log(err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_user;