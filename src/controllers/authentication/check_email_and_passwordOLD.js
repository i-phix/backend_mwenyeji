const db = require('payservedb')
const bcrypt = require('bcryptjs');

const logger = require("../../../config/winston");
const { loginValidator2 } = require("../../utils/validator");

const check_email_and_password = async (request, reply) => {
    try {
        const validationResults = await loginValidator2.validate(request.body)
        if (validationResults.error) {
            logger.error(validationResults.error.details[0].message);
            return reply.code(400).send({ error: validationResults.error.details[0].message });
        }
        const { email, password, platform } = validationResults.value;

        if (platform !== 'Mobile') {
            let type
            if (platform === 'Resident') {
                type = 'Resident'
            }
            else if (platform === 'Core') {
                type = 'Universal'
            }
            else if (platform === 'App') {
                type = 'Company'
            }

            const userExist = await db.User.findOne({ email: email, type: type });
            if (userExist) {
                const isMatch = await bcrypt.compare(password, userExist.password);
                if (isMatch) {

                    function generateRandomFiveDigitNumber() {
                        const randomNumber = Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
                        return randomNumber;
                    }
                    const code = generateRandomFiveDigitNumber();
                    let query = {
                        _id: userExist._id
                    }
                    let data = {
                        verificationCode: code,
                        verificationExpiration: getFiveMinutesLater()
                    }

                    await db.User.updateOne(query, data)
                    logger.info(`${userExist.email} exists.`)
                    return reply.code(200).send(`${userExist.email} exists.`)
                }
                else {
                    return reply.code(403).send({
                        error: "Email or Password is invalid"
                    })
                }
            }
            else {
                return reply.code(403).send({
                    error: "Email or Password is invalid"
                })
            }
        }
        else {


            const userExist = await db.User.findOne({ email: email, type: { $in: ['Company', 'Resident'] } });
            if (userExist) {
                const isMatch = await bcrypt.compare(password, userExist.password);
                if (isMatch) {

                    function generateRandomFiveDigitNumber() {
                        const randomNumber = Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
                        return randomNumber;
                    }
                    const code = generateRandomFiveDigitNumber();
                    let query = {
                        _id: userExist._id
                    }
                    let data = {
                        verificationCode: code,
                        verificationExpiration: getFiveMinutesLater()
                    }

                    await db.User.updateOne(query, data)
                    logger.info(`${userExist.email} exists.`)
                    return reply.code(200).send(`${userExist.email} exists.`)
                }
                else {
                    return reply.code(403).send({
                        error: "Email or Password is invalid"
                    })
                }
            }
            else {
                return reply.code(403).send({
                    error: "Email or Password is invalid"
                })
            }
        }

    }
    catch (err) {
        logger.error(err.message);
        return reply.code(502).send({ error: err.message })

    }
}
function getFiveMinutesLater() {
    const currentDate = new Date(); // Get current date and time
    const fiveMinutesLater = new Date(currentDate.getTime() + 5 * 60000); // Add 5 minutes (60000 ms in a minute)

    return fiveMinutesLater;
}
module.exports = check_email_and_password