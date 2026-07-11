const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const { sendSms } = require("../../../utils/send_new_sms");
const { createShortUrl } = require("../../../utils/url_shortener/short_url");

const send_handover_sms = async (request, reply) => {
  console.log("[send_handover_sms] Handler called!");
  try {
    const { facilityId, handoverId } = request.params;
    const { testPhone } = request.query; // Optional test phone for testing purposes
    console.log("[send_handover_sms] Params:", { facilityId, handoverId, testPhone });

    if (!facilityId || !handoverId) {
      return reply.code(400).send({
        success: false,
        error: "Facility ID and handover ID are required.",
      });
    }

    const handoverModel = await getModel(
      "Handover",
      payservedb.Handover.schema,
      facilityId,
    );

    const handover = await handoverModel.findById(handoverId).lean();
    if (!handover) {
      return reply.code(404).send({
        success: false,
        error: "Handover not found.",
      });
    }

    // Get customer info
    let customer = null;
    if (handover.customerId) {
      customer = await payservedb.Customer.findById(handover.customerId);
    }

    // Use test phone if provided, otherwise use customer phone
    const customerPhone = testPhone || customer?.phoneNumber || customer?.phone;
    if (!customerPhone) {
      return reply.code(400).send({
        success: false,
        error: "Customer phone number not available for this handover. Use ?testPhone=xxx for testing.",
      });
    }

    // Get unit info
    let unit = null;
    if (handover.unitId) {
      const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);
      unit = await unitModel.findById(handover.unitId).lean();
    }

    const unitName = unit?.name || unit?.unitNumber || "your unit";
    const handoverType =
      handover.handoverType === "MoveIn" ? "Move-In" : "Move-Out";

    // Generate PDF download link
    const backendUrl = process.env.BACKEND_URL || "https://api.payserve.co.ke";
    const longUrl = `${backendUrl}/api/app/handover_management/public/handover_pdf/${facilityId}/${handoverId}`;

    // Try to create short URL
    let downloadUrl = longUrl;
    try {
      const shortCode = await createShortUrl(longUrl);
      if (shortCode && request.server?.redis) {
        await request.server.redis.set(`url:short:${shortCode}`, longUrl, "EX", 31536000);
        downloadUrl = `${backendUrl}/s/${shortCode}`;
      }
    } catch (e) {
      // Use long URL if short URL creation fails
      request.log.warn(`Failed to create short URL: ${e.message}`);
    }

    // Format phone number - ensure it's in the correct format
    let formattedPhone = customerPhone.trim();
    if (formattedPhone.startsWith("0")) {
      formattedPhone = formattedPhone.slice(1);
    }
    if (!formattedPhone.startsWith("254")) {
      formattedPhone = `254${formattedPhone}`;
    }

    // Build SMS message
    const message = `Your ${handoverType} handover for ${unitName} is ready. Download your handover report: ${downloadUrl}`;

    // Send the SMS
    await sendSms(facilityId, formattedPhone, message);

    return reply.code(200).send({
      success: true,
      message: `Handover SMS sent to ${formattedPhone}`,
      recipient: formattedPhone,
    });
  } catch (error) {
    console.error("[send_handover_sms] Error:", error.message);
    console.error("[send_handover_sms] Stack:", error.stack);
    request.log.error(error);
    return reply.code(500).send({
      success: false,
      error: error.message || "Failed to send handover SMS.",
    });
  }
};

module.exports = send_handover_sms;
