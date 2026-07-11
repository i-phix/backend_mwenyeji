const payservedb = require("payservedb");
const get_dashboard_data = async (request, reply) => {
  try {
    const customers = await payservedb.Customer.find({});
    const companies = await payservedb.Company.find({});
    const facilities = await payservedb.Facility.find({});
    return reply
      .code(200)
      .send({
        customers: customers.length,
        companies: companies.length,
        facilities: facilities.length,
      });
  } catch (err) {
    console.log(err.message);
    return reply.code(502).send({ error: err.message });
  }
};
module.exports = get_dashboard_data;
