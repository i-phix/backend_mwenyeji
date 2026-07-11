const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const payservedb = require("payservedb");
const { getModel } = require("../../../../utils/getModel");

const download_handover_pdf = async (request, reply) => {
  try {
    const { facilityId, handoverId } = request.params;

    if (!facilityId || !handoverId) {
      return reply.code(400).send({
        success: false,
        error: "Facility ID and handover ID are required.",
      });
    }

    // Step 1: Gather ALL data first before creating PDF
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

    // Get facility (from global db)
    const facility = await payservedb.Facility.findById(facilityId).lean();

    // Get unit
    let unit = null;
    if (handover.unitId) {
      const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);
      unit = await unitModel.findById(handover.unitId).lean();
    }

    // Get customer
    let customer = null;
    if (handover.customerId) {
      customer = await payservedb.Customer.findById(handover.customerId).lean();
    }

    // Get default currency
    let defaultCurrency = null;
    try {
      const currencyModel = await getModel(
        "Currency",
        payservedb.Currency.schema,
        facilityId,
      );
      const currencies = await currencyModel.find({}).lean();
      defaultCurrency =
        (currencies || []).find((curr) => curr.isDefaultCurrency) ||
        (currencies || [])[0] ||
        null;
    } catch (currencyError) {
      console.error("[download_handover_pdf] Currency error:", currencyError.message);
    }

    // Get unpaid invoices for this unit and customer
    let unpaidInvoices = [];
    try {
      if (handover.unitId && handover.customerId) {
        const invoiceModel = await getModel(
          "Invoice",
          payservedb.Invoice.schema,
          facilityId,
        );
        const rawInvoices = await invoiceModel
          .find({
            "unit.id": handover.unitId,
            "client.clientId": handover.customerId,
            status: { $in: ["Unpaid", "Overdue", "Partially Paid"] },
          })
          .select({
            _id: 1,
            invoiceNumber: 1,
            unit: 1,
            totalAmount: 1,
            amountPaid: 1,
            issueDate: 1,
            dueDate: 1,
            status: 1,
            whatFor: 1,
            items: 1,
            currency: 1,
            balanceBroughtForward: 1,
          })
          .lean();

        if (Array.isArray(rawInvoices)) {
          const invoicesWithBalance = rawInvoices.map((invoice) => {
            const balance =
              (invoice.totalAmount || 0) -
              (invoice.amountPaid || 0) +
              ((invoice.balanceBroughtForward || 0) > 0
                ? invoice.balanceBroughtForward
                : 0);
            return {
              ...invoice,
              balance,
              formattedDate: new Date(
                invoice.issueDate || Date.now(),
              ).toLocaleDateString(),
              formattedDueDate: new Date(
                invoice.dueDate || Date.now(),
              ).toLocaleDateString(),
            };
          });

          unpaidInvoices = invoicesWithBalance.filter(
            (invoice) => (invoice.balance || 0) > 0,
          );
        }
      }
    } catch (invoiceError) {
      console.error("[download_handover_pdf] Invoice error:", invoiceError.message);
    }

    // Prepare all data
    const facilityName = facility?.name || "Property Management";
    const unitName = unit?.name || unit?.unitNumber || "Unknown Unit";
    const customerName = customer
      ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
      : "Unknown Customer";
    const customerPhone = customer?.phoneNumber || customer?.phone || "N/A";
    const customerEmail = customer?.email || customer?.emailAddress || "N/A";
    const customerIdNumber = customer?.idNumber || "N/A";
    const handoverType = handover.handoverType === "MoveIn" ? "Move-In" : "Move-Out";
    const handoverDate = handover.handoverDate
      ? new Date(handover.handoverDate).toLocaleDateString()
      : "N/A";
    const meterReadings = handover.meterReadings || {};
    const items = Array.isArray(handover.items) ? handover.items : [];
    const attachments = Array.isArray(handover.attachments) ? handover.attachments : [];
    let logoPath = null;
    if (facility?.logo) {
      try {
        const logoUrl = new URL(facility.logo);
        const localPath = path.resolve(process.cwd(), `.${logoUrl.pathname}`);
        logoPath = localPath;
      } catch (e) {
        if (facility.logo.startsWith('/uploads/')) {
          logoPath = path.resolve(process.cwd(), `.${facility.logo}`);
        } else if (facility.logo.startsWith('uploads/')) {
          logoPath = path.resolve(process.cwd(), facility.logo);
        } else {
          logoPath = path.resolve(process.cwd(), facility.logo);
        }
      }
    }

    // Step 2: Generate PDF and collect in buffer
    const pdfBuffer = await generatePDF({
      facilityName,
      unitName,
      customerName,
      customerPhone,
      customerEmail,
      customerIdNumber,
      handoverType,
      handoverDate,
      handover,
      meterReadings,
      items,
      attachments,
      defaultCurrency,
      unpaidInvoices,
      logoPath,
    });

    // Step 3: Send the PDF
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename=handover_${unitName.replace(/[^a-zA-Z0-9]/g, "_")}_${handoverDate.replace(/\//g, "-")}.pdf`)
      .send(pdfBuffer);

  } catch (error) {
    console.error("[download_handover_pdf] Error:", error);
    request.log.error(error);
    return reply.code(500).send({
      success: false,
      error: error.message || "Failed to generate handover PDF.",
    });
  }
};

// Helper function to generate PDF and return buffer
function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const {
      facilityName,
      unitName,
      customerName,
      customerPhone,
      customerEmail,
      customerIdNumber,
      handoverType,
      handoverDate,
      handover,
      meterReadings,
      items,
      attachments,
      defaultCurrency,
      unpaidInvoices,
      logoPath
    } = data;

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const currencyCode = defaultCurrency?.currencyShortCode || "USD";

    const drawSectionHeader = (title) => {
      if (doc.y > 720) {
        doc.addPage();
      }
      const y = doc.y;
      doc.save();
      doc.rect(50, y, 495, 22).fill("#eef2f7");
      doc.fillColor("#1f2937").fontSize(11).font("Helvetica-Bold").text(title, 58, y + 5);
      doc.restore();
      doc.y = y + 28;
    };

    const formatMoney = (value, code = currencyCode) =>
      `${code} ${(parseFloat(value || 0)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;

    // Header with facility name and logo
    doc.save();
    doc.rect(50, 30, 495, 70).fill("#f4f6fb");
    if (logoPath && fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 60, 38, { fit: [60, 60] });
      } catch (e) {
        doc.fontSize(10).font("Helvetica").fillColor("#6b7280").text("(Logo)", 60, 60);
      }
    }
    doc.fillColor("#111827").fontSize(16).font("Helvetica-Bold").text(facilityName, 130, 42);
    doc.fillColor("#374151").fontSize(12).font("Helvetica").text(`${handoverType} Handover Report`, 130, 62);
    doc.fillColor("#6b7280").fontSize(9).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, 130, 79);
    doc.restore();

    doc.y = 120;

    // Customer & Unit Details
    drawSectionHeader("Customer & Unit Details");
    doc.fontSize(10).font("Helvetica");

    const infoStartY = doc.y;
    const infoLineHeight = 14;
    const leftLines = [
      `Unit: ${unitName}`,
      `Customer: ${customerName}`,
      `ID Number: ${customerIdNumber}`,
      `Phone: ${customerPhone}`,
      `Email: ${customerEmail}`,
    ];
    const rightLines = [
      `Handover Date: ${handoverDate}`,
      `Status: ${handover.status || "Draft"}`,
      `Keys Handed Over: ${handover.keysHandedOver || 0}`,
    ];

    leftLines.forEach((line, index) => {
      doc.text(line, 50, infoStartY + infoLineHeight * index);
    });
    rightLines.forEach((line, index) => {
      doc.text(line, 300, infoStartY + infoLineHeight * index);
    });

    const infoBlockHeight =
      Math.max(leftLines.length, rightLines.length) * infoLineHeight + 6;
    doc.y = infoStartY + infoBlockHeight;

    // Meter Readings Section
    drawSectionHeader("Meter Readings");
    doc.fontSize(10).font("Helvetica");

    const meterY = doc.y;
    doc.text(`Electricity: ${meterReadings.electricity?.reading || "Not recorded"}`, 50, meterY);
    doc.text(`Water: ${meterReadings.water?.reading || "Not recorded"}`, 220, meterY);
    doc.text(`Gas: ${meterReadings.gas?.reading || "Not recorded"}`, 390, meterY);

    doc.moveDown(1);

    // Security Deposit & Deductions (Move-Out)
    if (handover.handoverType === "MoveOut") {
      drawSectionHeader("Security Deposit & Deductions");
      const depositAmount = handover.securityDeposit?.amount || 0;
      const deductions = Array.isArray(handover.securityDeposit?.deductions)
        ? handover.securityDeposit.deductions
        : [];
      const totalDeductions = deductions.reduce(
        (sum, deduction) => sum + (parseFloat(deduction.amount) || 0),
        0,
      );
      const refundAmount =
        handover.securityDeposit?.refundAmount != null
          ? handover.securityDeposit.refundAmount
          : depositAmount - totalDeductions;

      doc.fontSize(10).font("Helvetica");
      doc.text(`Deposit Amount: ${formatMoney(depositAmount)}`, 50, doc.y);
      doc.text(`Total Deductions: ${formatMoney(totalDeductions)}`, 220, doc.y);
      doc.text(`Refund Amount: ${formatMoney(refundAmount)}`, 390, doc.y);
      doc.moveDown(0.6);

      if (deductions.length === 0) {
        doc.fontSize(9).font("Helvetica").text("No deductions recorded.");
      } else {
        const tableTop = doc.y;
        const tableLeft = 50;
        doc.fontSize(9).font("Helvetica-Bold");
        doc.text("#", tableLeft, tableTop, { width: 20 });
        doc.text("Reason", tableLeft + 20, tableTop, { width: 170 });
        doc.text("Description", tableLeft + 190, tableTop, { width: 220 });
        doc.text("Amount", tableLeft + 410, tableTop, { width: 80, align: "right" });
        doc.moveTo(tableLeft, doc.y + 3).lineTo(545, doc.y + 3).stroke();
        doc.moveDown(0.4);

        doc.fontSize(9).font("Helvetica");
        deductions.forEach((deduction, index) => {
          if (doc.y > 700) {
            doc.addPage();
          }
          const rowY = doc.y;
          doc.text(`${index + 1}`, tableLeft, rowY, { width: 20 });
          doc.text(deduction.reason || "Unspecified", tableLeft + 20, rowY, { width: 170 });
          doc.text(deduction.description || "-", tableLeft + 190, rowY, { width: 220 });
          const deductionCurrency =
            deduction.currency?.currencyShortCode ||
            deduction.currency?.code ||
            currencyCode;
          doc.text(formatMoney(deduction.amount || 0, deductionCurrency), tableLeft + 410, rowY, { width: 80, align: "right" });
          doc.moveDown(0.5);
        });
      }
      doc.moveDown(0.8);
    }

    // Inventory Items Section
    drawSectionHeader("Inventory Items");

    if (items.length === 0) {
      doc.fontSize(10).font("Helvetica").text("No items recorded");
    } else {
      const tableTop = doc.y;
      const tableLeft = 50;

      doc.fontSize(9).font("Helvetica-Bold");
      doc.text("#", tableLeft, tableTop, { width: 20 });
      doc.text("Item Name", tableLeft + 20, tableTop, { width: 100 });
      doc.text("Category", tableLeft + 120, tableTop, { width: 70 });
      doc.text("Condition", tableLeft + 190, tableTop, { width: 65 });
      doc.text("Qty", tableLeft + 255, tableTop, { width: 25 });
      doc.text("Notes", tableLeft + 280, tableTop, { width: 215 });

      doc.moveTo(tableLeft, doc.y + 3).lineTo(545, doc.y + 3).stroke();
      doc.moveDown(0.4);

      doc.fontSize(9).font("Helvetica");
      items.forEach((item, index) => {
        if (doc.y > 700) {
          doc.addPage();
        }

        const rowY = doc.y;
        doc.text(`${index + 1}`, tableLeft, rowY, { width: 20 });
        doc.text(item?.name || "Unnamed Item", tableLeft + 20, rowY, { width: 100 });
        doc.text(item?.category || "N/A", tableLeft + 120, rowY, { width: 70 });
        doc.text(item?.condition || "Unknown", tableLeft + 190, rowY, { width: 65 });
        doc.text(`${item?.quantity || 1}`, tableLeft + 255, rowY, { width: 25 });
        doc.text(item?.notes || "-", tableLeft + 280, rowY, { width: 215 });

        doc.moveDown(0.6);
      });
    }
    doc.moveDown(1);

    // Unpaid Invoices Section
    drawSectionHeader("Unpaid Invoices");
    if (!unpaidInvoices || unpaidInvoices.length === 0) {
      doc.fontSize(10).font("Helvetica").text("No unpaid invoices found");
    } else {
      const tableTop = doc.y;
      const tableLeft = 50;
      doc.fontSize(9).font("Helvetica-Bold");
      doc.text("Invoice #", tableLeft, tableTop, { width: 80 });
      doc.text("Type", tableLeft + 80, tableTop, { width: 100 });
      doc.text("Due Date", tableLeft + 180, tableTop, { width: 90 });
      doc.text("Status", tableLeft + 270, tableTop, { width: 80 });
      doc.text("Balance", tableLeft + 350, tableTop, { width: 90, align: "right" });
      doc.moveTo(tableLeft, doc.y + 3).lineTo(545, doc.y + 3).stroke();
      doc.moveDown(0.4);

      doc.fontSize(9).font("Helvetica");
      unpaidInvoices.forEach((invoice) => {
        if (doc.y > 700) {
          doc.addPage();
        }
        const rowY = doc.y;
        const invCurrency = invoice.currency?.code || invoice.currency?.currencyShortCode || currencyCode;
        doc.text(invoice.invoiceNumber || "N/A", tableLeft, rowY, { width: 80 });
        doc.text(invoice.whatFor?.invoiceType || "Invoice", tableLeft + 80, rowY, { width: 100 });
        doc.text(invoice.formattedDueDate || "N/A", tableLeft + 180, rowY, { width: 90 });
        doc.text(invoice.status || "Unpaid", tableLeft + 270, rowY, { width: 80 });
        doc.text(formatMoney(invoice.balance || 0, invCurrency), tableLeft + 350, rowY, { width: 90, align: "right" });
        doc.moveDown(0.5);
      });
    }
    doc.moveDown(1);

    // Notes Section
    drawSectionHeader("Notes");
    doc.fontSize(10).font("Helvetica").text(handover.notes || "No additional notes");
    doc.moveDown(1);

    // Attachments Section
    drawSectionHeader("Attachments");
    if (attachments.length === 0) {
      doc.fontSize(10).font("Helvetica").text("No attachments");
    } else {
      doc.fontSize(10).font("Helvetica");
      attachments.forEach((attachment, index) => {
        const name = attachment.name || attachment.fileName || `Attachment ${index + 1}`;
        const uploadDate = attachment.uploadDate
          ? new Date(attachment.uploadDate).toLocaleDateString()
          : "N/A";
        doc.text(`${index + 1}. ${name} (Uploaded: ${uploadDate})`);
      });
    }
    doc.moveDown(1);

    // Check if we need a new page for signatures
    if (doc.y > 580) {
      doc.addPage();
    }

    // Signatures Section
    drawSectionHeader("Signatures");

    const signatureY = doc.y;
    const signatureBoxHeight = 100;
    const signatureBoxWidth = 230;

    // Property Manager Signature Box
    doc.rect(50, signatureY, signatureBoxWidth, signatureBoxHeight).stroke();
    doc.fontSize(10).font("Helvetica-Bold").text("Property Manager", 60, signatureY + 10);

    if (handover.signatures?.propertyManager?.signature) {
      try {
        const sigData = handover.signatures.propertyManager.signature;
        if (sigData.startsWith && sigData.startsWith("data:image")) {
          doc.image(sigData, 60, signatureY + 28, { width: 180, height: 45 });
        } else {
          doc.fontSize(9).font("Helvetica").text("(Signature on file)", 60, signatureY + 45);
        }
      } catch (e) {
        doc.fontSize(9).font("Helvetica").text("(Signature on file)", 60, signatureY + 45);
      }
      const pmSignDate = handover.signatures.propertyManager.date
        ? new Date(handover.signatures.propertyManager.date).toLocaleDateString()
        : "N/A";
      doc.fontSize(9).font("Helvetica").text(`Signed: ${pmSignDate}`, 60, signatureY + 80);
    } else {
      doc.fontSize(10).font("Helvetica").text("Not signed", 60, signatureY + 50);
    }

    // Customer Signature Box
    doc.rect(310, signatureY, signatureBoxWidth, signatureBoxHeight).stroke();
    doc.fontSize(10).font("Helvetica-Bold").text("Customer", 320, signatureY + 10);

    if (handover.signatures?.customer?.signature) {
      try {
        const sigData = handover.signatures.customer.signature;
        if (sigData.startsWith && sigData.startsWith("data:image")) {
          doc.image(sigData, 320, signatureY + 28, { width: 180, height: 45 });
        } else {
          doc.fontSize(9).font("Helvetica").text("(Signature on file)", 320, signatureY + 45);
        }
      } catch (e) {
        doc.fontSize(9).font("Helvetica").text("(Signature on file)", 320, signatureY + 45);
      }
      const custSignDate = handover.signatures.customer.date
        ? new Date(handover.signatures.customer.date).toLocaleDateString()
        : "N/A";
      doc.fontSize(9).font("Helvetica").text(`Signed: ${custSignDate}`, 320, signatureY + 80);
    } else {
      doc.fontSize(10).font("Helvetica").text("Not signed", 320, signatureY + 50);
    }

    // Footer
    doc.fontSize(8).font("Helvetica").fillColor("gray");
    doc.text(
      `Generated on ${new Date().toLocaleString()} | ${facilityName}`,
      50,
      doc.page.height - 40,
      { align: "center" }
    );

    // End the document - triggers the 'end' event
    doc.end();
  });
}

module.exports = download_handover_pdf;
