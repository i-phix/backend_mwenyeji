const payservedb = require("payservedb");
const bcrypt = require("bcryptjs");
const { sendSms } = require("../../../../utils/send_new_sms");
const { sendEmail } = require("../../../../utils/send_new_email");

const add_new_user = async (request, reply) => {
  try {
    const { firstName, lastName, email, phoneNumber, role } = request.body;
    console.log(request.body);
    const userExist = await payservedb.User.findOne({ email });
    if (userExist) {
      throw new Error("User already exists");
    } else {
      const slicedPhoneNumber = phoneNumber.slice(-9);
      const fullName = firstName + " " + lastName;
      const pass = generatePassword();
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(pass, saltRounds);
      const data = new payservedb.User({
        fullName,
        email,
        phoneNumber: slicedPhoneNumber,
        role,
        type: "Universal",
        companies: [],
        password: hashedPassword,
      });
      await data.save();
      const message = `Dear user, login link: ${process.env.coreFrontEndUrl}.\nUsername: ${email}\nPassword: ${pass}`;

      sendSms(facilityResult._id, slicedPhoneNumber, message);
      sendEmail(facilityResult._id, email, 'Welcome Aboard! Access Your PayServe Account Today', message);

      sendMessageToQueue(
        "Payserve",
        slicedPhoneNumber,
        "LOGIN CREDENTIALS",
        message,
        "Email",
      );
      sendMessageToQueue(
        "Payserve",
        slicedPhoneNumber,
        "",
        message,
        "SMS Meliora",
      );
      return reply.code(200).send("User added successfully.");
    }
  } catch (err) {
    console.error("Error occurred:", err); // Log the exact error
    return reply.code(502).send(err.message || "Internal server error");
  }
};
function generatePassword(length = 8) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    password += characters[randomIndex];
  }
  return password;
}
module.exports = add_new_user;
