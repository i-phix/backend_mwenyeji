const PlatformSetting = require("../../models/PlatformSetting");

const VALID_RULES = ["same_as_rent", "percentage_of_rent", "fixed_amount"];

// Shared by the three PUT .../payment-settings/{reservation-fee,viewing-fee,commission}
// routes — `block` selects which sub-document to update.
function makeUpdateFeeSetting(block) {
  return async function updateFeeSetting(request, reply) {
    try {
      const { rule, value } = request.body || {};
      if (!VALID_RULES.includes(rule)) {
        return reply.code(400).send({ error: `rule must be one of ${VALID_RULES.join(", ")}` });
      }

      const settings = await PlatformSetting.getSingleton();
      settings[block] = { rule, value: Number(value) || 0 };
      await settings.save();

      return reply.code(200).send({ success: true, data: settings[block] });
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: err.message });
    }
  };
}

module.exports = makeUpdateFeeSetting;
