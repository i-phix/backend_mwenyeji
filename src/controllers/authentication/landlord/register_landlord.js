// const db = require('payservedb');
// const bcrypt = require('bcryptjs');
// const logger = require('../../../../config/winston');

// // POST /api/auth/landlord/register
// const register_landlord = async (request, reply) => {
//     try {
//         const { fullName, email, phone, password, companyName, companyPin, companyAddress, numberOfFacilities } = request.body;

//         if (!fullName || !email || !phone || !password) {
//             return reply.code(400).send({ error: 'fullName, email, phone, and password are required.' });
//         }

//         if (password.length < 8) {
//             return reply.code(400).send({ error: 'Password must be at least 8 characters.' });
//         }

//         const normalizedPhone = phone.replace(/\D/g, '').slice(-9);
//         const normalizedEmail = email.toLowerCase().trim();

//         const [existingEmail, existingPhone] = await Promise.all([
//             db.User.findOne({ email: normalizedEmail }),
//             db.User.findOne({ phoneNumber: normalizedPhone }),
//         ]);

//         if (existingEmail) return reply.code(409).send({ error: 'An account with this email already exists.' });
//         if (existingPhone) return reply.code(409).send({ error: 'An account with this phone number already exists.' });

//         const salt = await bcrypt.genSalt(10);
//         const hashedPassword = await bcrypt.hash(password, salt);

//         // Generate OTP for email verification
//         const verificationCode = Math.floor(100000 + Math.random() * 900000);
//         const verificationExpiration = new Date(Date.now() + 10 * 60 * 1000); // 10 min

//         const newUser = new db.User({
//             fullName: fullName.trim(),
//             email: normalizedEmail,
//             phoneNumber: normalizedPhone,
//             password: hashedPassword,
//             type: 'Landlord',
//             role: 'user',
//             isEnabled: false, // disabled until admin activates or OTP verified
//             verificationCode,
//             verificationExpiration,
//         });

//         await newUser.save();

//         // TODO: send OTP email via the notification service when integrated

//         logger.info(`[auth] New landlord registered: ${normalizedEmail}${companyName ? ` — company: ${companyName}` : ' — individual'}`);
//         return reply.code(200).send({
//             success: true,
//             message: 'Landlord account created. Check your email for the OTP verification code.',
//             userId: newUser._id,
//         });
//     } catch (err) {
//         logger.error('[auth/landlord/register] ' + err.message);
//         return reply.code(502).send({ error: err.message });
//     }
// };

// module.exports = register_landlord;
