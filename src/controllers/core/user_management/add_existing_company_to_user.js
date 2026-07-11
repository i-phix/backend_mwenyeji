const payservedb = require("payservedb");
const logger = require("../../../../config/winston");
const add_existing_company_to_user = async (request, reply) => {
  try {
    const { userId, companyId } = request.params;
    console.log(request.params);
    const userExist = await payservedb.User.findById(userId);
    if (!userExist) {
      throw new Error("User doesn't exist");
    }

    let companies = userExist.companies;
    companies.push(companyId);
    let query = {
      _id: userId,
    };
    let data = {
      companies: companies,
    };

    await payservedb.User.updateOne(query, data);
    logger.info("New company added to user");
    return reply.code(200).send("New company added to user");
  } catch (err) {
    logger.error(err.message);
    console.log(err);
    return reply.code(502).send({ error: err.message });
  }
};
module.exports = add_existing_company_to_user;
