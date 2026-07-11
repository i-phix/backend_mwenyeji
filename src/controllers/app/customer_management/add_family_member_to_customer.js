const payservedb = require("payservedb");
const bcrypt = require("bcryptjs");
const { sendSms } = require("../../../utils/send_new_sms");
const { sendEmail } = require("../../../utils/send_new_email");

const add_family_member = async (request, reply) => {
  try {
    const { customerId } = request.params;
    const {
      name,
      phone,
      email,
      relation,
      visitorQRCode,
      addVisitor,
      receiveMessage,
    } = request.body; // Extract data from the request body

    // Validate input
    if (!name || !phone || !relation) {
      return reply.code(400).send({ error: "All fields are required." });
    }

    const customer = await payservedb.Customer.findById(customerId);
    if (!customer) {
      return reply.code(404).send({ error: "Customer not found." });
    }
    const generateRandomNumber = () => {
      return Math.floor(Math.random() * (1000000 - 10000)) + 10000;
    };
    // Create a new family member entry
    const newFamilyMember = {
      no: generateRandomNumber(),
      name,
      email,
      phoneNumber: phone.slice(-9),
      relation,
      qrCode: visitorQRCode,
      disabled: false,
      addVisitor,
      receiveMessage,
    };

    // Add family member to the customer's familyMembers array
    customer.familyMembers.push(newFamilyMember);

    // Save the updated customer document
    await customer.save();
    if (addVisitor) {
      const filterUser = await payservedb.User.findOne({ email });
      if (filterUser) {
        const query = {
          _id: filterUser._id,
        };
        let customerData = filterUser.customerData;
        customerData.push({
          facilityId: customer.facilityId,
          customerId: customer._id,
          isEnabled: true,
        });
        let data = {
          customerData,
        };
        await payservedb.User.updateOne(query, data);
      } else {
        const password = "PXDS" + generateRandomNumber();
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const dataUser = new payservedb.User({
          fullName: name,
          email: email,
          phoneNumber: phone.slice(-9),
          idNumber: "00000",
          type: "Resident",
          role: "family",
          kyc: {},
          companies: [],
          customerData: [
            {
              facilityId: customer.facilityId,
              customerId: customer._id,
              isEnabled: true,
            },
          ],
          password: hashedPassword,
        });
        const responseUser = await dataUser.save();
        // sendMessageToQueue(
        //   "Payserve",
        //   responseUser.email,
        //   "LOGIN CREDENTIALS",
        //   `Dear resident, please login to https://resident..co.ke\nLogin Credentials:\nUsername: ${email},\nPassword: ${password}`,
        //   "Email",
        // );
        const message = `Dear resident, please login to ${process.env.residentFrontEndUrl} Credentials:\nUsername: ${email},\nPassword: ${password}`;
        sendSms(customer.facilityId, responseUser.phoneNumber, message);
        sendEmail(customer.facilityId, responseUser.email, 'LOGIN CREDENTIALS', message);
      }
    }

    return reply
      .code(200)
      .send({ message: "Family member added to customer successfully." });
  } catch (err) {
    console.error("Error adding family member to customer:", err.message); // Log error for debugging
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = add_family_member;
