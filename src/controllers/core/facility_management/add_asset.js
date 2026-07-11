const payservedb = require("payservedb");
const add_asset = async (request, reply) => {
  try {
    const { id } = request.params;
    const { name } = request.body;

    const data = new payservedb.FacilityAsset({
      name: name,
      facilityId: id,
    });
    await data.save();
    return reply.code(200).send("Facility Asset added successfully");
  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};
module.exports = add_asset;
