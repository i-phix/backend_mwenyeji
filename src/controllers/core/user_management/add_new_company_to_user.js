const payservedb = require('payservedb');
const bcrypt = require('bcryptjs')
const { AddCompanyUser } = require('../../../utils/validator');
const logger = require('../../../../config/winston');
const add_new_company_to_user = async (request, reply) => {
    try {
        const validationResults = await AddCompanyUser.validate(request.body)
        if (validationResults.error) {
            logger.error(validationResults.error.details[0].message);
            return reply.code(400).send({ error: validationResults.error.details[0].message });
        }
        const { firstName, lastName, email, password } = validationResults.value;
        const { companyId } = request.params
        const userExist = await payservedb.User.findOne({ email: email })
        const companyExist = await payservedb.Company.findById(companyId);
        if (userExist) {
            throw new Error('User exist')
        }
        if (!companyExist) {
            throw new Error("Company doesn't exist")
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        let data = new payservedb.User({
            fullName: firstName + " " + lastName,
            email: email,
            phoneNumber: "",
            type: "Company",
            role: "admin",
            companies: [companyExist._id],
            password: hashedPassword
        })
        const result = await data.save();
        logger.info('New User added: ' + result)
        return reply.code(200).send(result)
    }
    catch (err) {
        logger.error(err.message)
        console.log(err)
        return reply.code(502).send({ error: err.message })
    }
}
module.exports = add_new_company_to_user