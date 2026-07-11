const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const add_email_settings = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      host,
      port,
      secure,
      sender,
      senderName,
      user,
      pass,
      rejectUnauthorized,
    } = request.body;

    const emailModel = await getModel(
      "FacilityEmailDetails",
      payservedb.FacilityEmailDetails.schema,
      facilityId,
    );

    const data = await emailModel.create({
      host,
      port,
      secure,
      sender,
      senderName,
      user,
      pass,
      rejectUnauthorized,
      facilityId,
    });

    return reply.code(200).send({
      success: true,
      message: "Email settings added successfully",
      data: data,
    });
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = add_email_settings;
