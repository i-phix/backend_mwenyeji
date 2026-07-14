const PlatformSetting = require("../../models/PlatformSetting");

// GET /api/move_in/admin/payment-settings — authenticated admin
async function getPaymentSettings(request, reply) {
  try {
    const settings = await PlatformSetting.getSingleton();
    return reply.code(200).send({
      success: true,
      data: {
        reservation: settings.reservation,
        viewing: settings.viewing,
        commission: settings.commission,
      },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getPaymentSettings;
