const payservedb = require('payservedb');
const bcrypt = require('bcryptjs')

const add_guard = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { userId } = request.user
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
        // Concatenate firstName and lastName into a fullName
        const phoneNumberExist = await payservedb.Guard.findOne({ phoneNumber: filteredPhoneNumber });
        const userExist = await payservedb.User.findById(userId)
        if (phoneNumberExist) {
            throw new Error('Guard phone number exist')
        }
        let array = [];
        selectedEntryPoints.map((x) => {
            array.push(x._id)
        })
        const guardData = new payservedb.Guard({
            firstName: firstName,
            lastName: lastName,
            entryPoints: array,
            email: email,
            phoneNumber: filteredPhoneNumber,
            startTime: startTime,
            endTime: endTime,
            status: "On Duty",
            facilityId: facilityId
        });
        const guardResult = await guardData.save();
        // Generate a hashed password for the user (you can replace this with any logic you prefer)
        const password = generatePassword(8); // Replace 'defaultPassword' with generated password logic
        // Create a corresponding user in the User schema
        const guardUserExist = await payservedb.User.findOne({ email: email ? email : `${firstName}${lastName}@gmail.com`.toLowerCase() })
        if (!guardUserExist) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const userData = new payservedb.User({
                fullName: `${firstName} ${lastName}`,
                email: email ? email : `${firstName}${lastName}@gmail.com`.toLowerCase(), // Use a suitable email logic here
                phoneNumber: filteredPhoneNumber,
                password: hashedPassword,
                type: 'Company',
                role: 'guard',
                companies: userExist ? userExist.companies : [],
                guardId: guardResult._id
            });

            const userResult = await userData.save();

        }

        return reply.code(200).send('Guard registered successfully');



    }
    catch (err) {
        console.log(err.message)
        return reply.code(502).send({ error: err.message });
    }
}
const generatePassword = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        password += chars[randomIndex];
    }

    return password;
};

module.exports = add_guard