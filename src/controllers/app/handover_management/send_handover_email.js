const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const { sendEmail } = require("../../../utils/send_new_email");

const send_handover_email = async (request, reply) => {
  console.log("[send_handover_email] Handler called!");

  try {
    const { facilityId, handoverId } = request.params;
    const { testEmail } = request.query;

    console.log("[send_handover_email] Params:", { facilityId, handoverId, testEmail });

    if (!facilityId || !handoverId) {
      return reply.code(400).send({
        success: false,
        error: "Facility ID and handover ID are required.",
      });
    }

    // Step 1: Get handover
    console.log("[send_handover_email] Step 1: Getting handover model...");
    const handoverModel = await getModel("Handover", payservedb.Handover.schema, facilityId);

    console.log("[send_handover_email] Step 2: Finding handover...");
    const handover = await handoverModel.findById(handoverId).lean();

    if (!handover) {
      return reply.code(404).send({ success: false, error: "Handover not found." });
    }
    console.log("[send_handover_email] Step 3: Handover found");

    // Step 2: Get customer
    console.log("[send_handover_email] Step 4: Getting customer...");
    let customer = null;
    if (handover.customerId) {
      customer = await payservedb.Customer.findById(handover.customerId);
    }
    console.log("[send_handover_email] Step 5: Customer:", customer ? "found" : "not found");

    // Step 3: Determine recipient
    const recipientEmail = testEmail || customer?.email;
    if (!recipientEmail) {
      return reply.code(400).send({
        success: false,
        error: "No email available. Use ?testEmail=xxx for testing.",
      });
    }
    console.log("[send_handover_email] Step 6: Recipient:", recipientEmail);

    // Step 4: Get facility (from global db, not tenant db)
    console.log("[send_handover_email] Step 7: Getting facility...");
    const facility = await payservedb.Facility.findById(facilityId).lean();
    console.log("[send_handover_email] Step 8: Facility:", facility ? facility.name : "not found");

    // Step 5: Get unit
    console.log("[send_handover_email] Step 9: Getting unit...");
    let unit = null;
    if (handover.unitId) {
      const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);
      unit = await unitModel.findById(handover.unitId).lean();
    }
    console.log("[send_handover_email] Step 10: Unit:", unit ? (unit.name || unit.unitNumber) : "not found");

    // Build simple email
    const facilityName = facility?.name || "Property Management";
    const unitName = unit?.name || unit?.unitNumber || "Unknown Unit";
    const customerName = customer ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() : "Customer";
    const handoverType = handover.handoverType === "MoveIn" ? "Move-In" : "Move-Out";
    const handoverDate = handover.handoverDate ? new Date(handover.handoverDate).toLocaleDateString() : "N/A";

    const backendUrl = process.env.BACKEND_URL || "http://localhost:3060";
    const pdfUrl = `${backendUrl}/api/app/handover_management/public/handover_pdf/${facilityId}/${handoverId}`;

    const subject = `${handoverType} Handover - ${unitName} | ${facilityName}`;

    const htmlContent = `
      <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1>${facilityName}</h1>
        <h2>${handoverType} Handover Report</h2>
        <p>Dear ${customer?.firstName || customerName},</p>
        <p>Your handover for <strong>${unitName}</strong> is ready.</p>
        <ul>
          <li><strong>Unit:</strong> ${unitName}</li>
          <li><strong>Date:</strong> ${handoverDate}</li>
          <li><strong>Status:</strong> ${handover.status || "Draft"}</li>
          <li><strong>Keys:</strong> ${handover.keysHandedOver || 0}</li>
        </ul>
        <p><a href="${pdfUrl}" style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Download PDF Report</a></p>
        <p>Best regards,<br>${facilityName} Management</p>
      </body>
      </html>
    `;

    const textContent = `${handoverType} Handover - ${unitName}\n\nDear ${customerName},\n\nYour handover for ${unitName} is ready.\n\nDownload PDF: ${pdfUrl}\n\nBest regards,\n${facilityName} Management`;

    // Step 6: Send email
    console.log("[send_handover_email] Step 11: Sending email to:", recipientEmail);
    await sendEmail(facilityId, recipientEmail, subject, textContent, htmlContent, facilityName);
    console.log("[send_handover_email] Step 12: Email sent!");

    return reply.code(200).send({
      success: true,
      message: `Handover sent to ${recipientEmail}`,
      recipient: recipientEmail,
    });

  } catch (error) {
    console.error("[send_handover_email] ERROR:", error.message);
    console.error("[send_handover_email] Stack:", error.stack);
    return reply.code(500).send({
      success: false,
      error: error.message || "Failed to send handover email.",
    });
  }
};

module.exports = send_handover_email;
