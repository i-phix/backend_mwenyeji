
const payservedb = require('payservedb')
const get_sms_email_settings = async (request, reply) => {
  try {
    const africastalking = await payservedb.SMSAfricastalking.findOne({ user: "Payserve" });
    const meliora = await payservedb.SMSMeliora.findOne({ user: "Payserve" });
    const email = await payservedb.Email.findOne({ user: "Payserve" });
    return reply.code(200).send({ africastalking, email, meliora })

  }
  catch (err) {
    console.log(err)
    return reply.code(502).send(err.message)

  }
}
module.exports = get_sms_email_settings