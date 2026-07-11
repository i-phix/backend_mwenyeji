const payservedb = require("payservedb");
const bcrypt = require("bcryptjs");
const path = require('path');
const { companyValidator } = require("../../../utils/validator");
const { sendSms } = require("../../../utils/send_new_sms");
const { sendEmail } = require("../../../utils/send_new_email");
const logger = require("../../../../config/winston");

const add_company = async (request, reply) => {
  try {
    // Manually parse divisionArray if it's a string
    if (typeof request.body.divisionArray === "string") {
      request.body.divisionArray = JSON.parse(request.body.divisionArray);
    }

    const validationResults = await companyValidator.validate(request.body);
    if (validationResults.error) {
      logger.error(validationResults.error.details[0].message);
      return reply
        .code(400)
        .send({ error: validationResults.error.details[0].message });
    }

    const {
      userType,
      firstName,
      lastName,
      email,
      idNumber,
      phoneNumber,
      facilityName,
      facilityLocation,
      subDivision,
      divisionArray,
      companyName,
      companyAddress,
      companyCity,
      companyRegistrationNumber,
      companyCountry,
      companyEmail,
      companyTaxNumber,
      companyPinNumber,
    } = validationResults.value;


    const companyPinNumberExist = await payservedb.Company.findOne({
      where: { companyPinNumber: companyPinNumber },
    });
    if (companyPinNumberExist) {
      logger.error("Pin number already exist");
      return reply
        .code(400)
        .send({ error: "Pin number already exist" });
    }

    const baseUrl = `${request.protocol}://${request.headers.host}/uploads`;

    // Files
    const logo = request.files?.logo
      ? `${baseUrl}/${path.basename(request.files.logo[0].path)}`
      : null;

    const taxDocument = request.files?.taxDocument
      ? `${baseUrl}/${path.basename(request.files.taxDocument[0].path)}`
      : null;

    const companyCertificateDocument = request.files?.companyCertificateDocument
      ? `${baseUrl}/${path.basename(request.files.companyCertificateDocument[0].path)}`
      : null;

    const IdPassportDocument = request.files?.IdPassportDocument
      ? `${baseUrl}/${path.basename(request.files.IdPassportDocument[0].path)}`
      : null;

    const generateDbName = (facilityName) => {
      const timestamp = Date.now();
      const cleanedName = facilityName
        .trim()
        .toLowerCase()
        .split(" ")[0]
        .replace(/[^a-z0-9]/g, "_");
      return `${cleanedName}_db_${timestamp}`;
    };

    // Generate the database name
    const dbName = generateDbName(facilityName);

    const facilityData = await payservedb.Facility({
      name: facilityName,
      location: facilityLocation,
      subDivision: subDivision,
      divisionArray: divisionArray,
      logo: logo,
      isEnabled: true,
      dbName,
    });
    const facilityResult = await facilityData.save();

    const companyExist = await payservedb.Company.findOne({
      name: userType === "Company" ? companyName : firstName + " " + lastName,
    });
    if (companyExist) {
      return reply.code(400).send({ error: "Company exists" });
    }
    const userExist = await payservedb.User.findOne({ email });

    const companyData = await payservedb.Company({
      name: userType === "Company" ? companyName : firstName + " " + lastName,
      address: userType === "Company" ? companyAddress : "",
      country: userType === "Company" ? companyCountry : "....",
      city: userType === "Company" ? companyCity : "....",
      registrationNumber:
        userType === "Company" ? companyRegistrationNumber : "....",
      companyTaxNumber: userType === "Company" ? companyTaxNumber : "....",
      companyPinNumber: userType === "Company" ? companyPinNumber : "....",
      email: userType === "Email" ? companyEmail : email,
      logo: logo,
      isEnabled: true,
      kyc: {
        taxCertificate: taxDocument,
        companyCertificate: companyCertificateDocument,
        Id: IdPassportDocument
      },
      facilities: [facilityResult._id],
    });
    const companyResult = await companyData.save();

    if (!userExist) {
      const password = generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);

      const userData = payservedb.User({
        fullName: firstName + " " + lastName,
        email: email,
        phoneNumber,
        idNumber: idNumber,
        type: "Company",
        role: "admin",
        companies: [companyResult._id],
        kyc: {},
        password: hashedPassword,
        customerData: [
          {
            facilityId: facilityResult._id,
            isEnabled: true,
          },
        ],
      });
      const userResult = await userData.save();

      sendNotification(userResult, password, facilityResult._id);
    } else {
      let query = { _id: userExist._id };
      let arr = userExist.companies;
      arr.push(companyResult._id);
      await payservedb.User.updateOne(query, {
        $set: { companies: arr },
        $push: {
          customerData: {
            facilityId: facilityResult._id,
            isEnabled: true,
          },
        },
      });
    }

    logger.info("A new company has been added");
    return reply.code(200).send("A new company has been added");
  } catch (err) {
    logger.error(err.message);
    console.error(err);
    return reply.code(502).send({ error: err.message });
  }
};

const generatePassword = (length = 8) => {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
};

const sendNotification = async (user, password, facilityId) => {
  const message = `Welcome to PayServe,  

  Your account has been successfully created. Please find your login credentials below:  

  - Username: ${user.email}  
  - Password: ${password}  

  You may access the platform using the following link:  
  ${process.env.appFrontEndUrl}  

  Click Here to change your password, \n${process.env.appFrontEndUrl}/reset_password/${user._id}.  

  Thank you for choosing PayServe. We look forward to supporting your property management needs.

  Best regards,  
  The PayServe Team`;

  sendSms(facilityId, user.phoneNumber, message);
  sendEmail(facilityId, user.email, 'Welcome Aboard! Access Your PayServe Account Today', message);
};

module.exports = add_company;
