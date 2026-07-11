const payservedb = require("payservedb");
const bcrypt = require("bcryptjs");
const { sendSms } = require('../../../../utils/send_new_sms');
const { sendEmail } = require("../../../../utils/send_new_email");
const { getModel } = require('../../../../utils/getModel');

const add_guard = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { userId } = request.user;
    const {
      firstName,
      lastName,
      phoneNumber,
      email,
      selectedEntryPoints,
      startTime,
      endTime,
    } = request.body;
    const filteredPhoneNumber = phoneNumber.slice(-9);
    
    const guardModel = await getModel('Guard', payservedb.Guard.schema, facilityId);

    const phoneNumberExist = await guardModel.findOne({
      phoneNumber: filteredPhoneNumber,
    });

    const userExist = await payservedb.User.findById(userId);

    if (phoneNumberExist) {
      throw new Error("Guard phone number exist");
    }

    let array = [];

    selectedEntryPoints.map((x) => {
      array.push(x._id);
    });

    const guardData = await guardModel.create({
      firstName: firstName,
      lastName: lastName,
      entryPoints: array,
      email: email,
      phoneNumber: filteredPhoneNumber,
      startTime: startTime,
      endTime: endTime,
      status: "On Duty",
      facilityId: facilityId,
    });
    const guardResult = await guardData.save();

    const password = generatePassword(8);
    // Create a corresponding user in the User schema
    const guardUserExist = await payservedb.User.findOne({
      email: email ? email : `${firstName}${lastName}@gmail.com`.toLowerCase(),
    });
    if (!guardUserExist) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const userData = new payservedb.User({
        fullName: `${firstName} ${lastName}`,
        email: email
          ? email
          : `${firstName}${lastName}@gmail.com`.toLowerCase(),
        phoneNumber: filteredPhoneNumber,
        password: hashedPassword,
        type: "Company",
        role: "guard",
        companies: userExist ? userExist.companies : [],
        facilityId: facilityId,
        guardId: guardResult._id,
      });

      const userResult = await userData.save();

      const message = `PayServe LOGIN CREDENTIALS: Dear ${firstName}, please login to https://app.payserve.co.ke
             Username: ${email},
             Password: ${password}
             Reset your password here:
             https://app.payserve.co.ke/reset_password/${userResult._id}`;

      sendSms(facilityId, filteredPhoneNumber, message);
      sendEmail(facilityId, email, 'GUARD LOGIN CREDENTIALS', message);
    }

    return reply.code(200).send({success: true, message: "Guard registered successfully"});
  } catch (err) {
    console.log(err.message);
    return reply.code(502).send({ error: err.message });
  }
};
const generatePassword = (length) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let password = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    password += chars[randomIndex];
  }

  return password;
};

module.exports = add_guard;
