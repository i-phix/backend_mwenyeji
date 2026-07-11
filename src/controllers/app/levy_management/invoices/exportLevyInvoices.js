const payservedb = require("payservedb");
const { getModel } = require("../../../../utils/getModel");

/**
 * Export levy invoices with full context (Customer, Unit, LevyType)
 * GET /v1/api/levy/invoices/export/:facilityId
 * Query params:
 *   - yearMonth: "2025-03" (optional)
 *   - startYearMonth: "2025-01" (optional, for range)
 *   - endYearMonth: "2025-03" (optional, for range)
 *   - customerId: ObjectId (optional)
 *   - unitId: ObjectId (optional)
 *   - levyTypeId: ObjectId (optional)
 *   - status: "Unpaid" | "Paid" | "Overdue" | "Void" (optional)
 *   - format: "json" | "summary" (default: "json")
 */
const exportLevyInvoices = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      yearMonth,
      startYearMonth,
      endYearMonth,
      customerId,
      unitId,
      levyTypeId,
      status,
      format = "json",
    } = request.query;

    // ── 1. Get all models ──────────────────────────────────────────────────
    const invoiceModel = await getModel(
      "Invoice",
      payservedb.Invoice.schema,
      facilityId
    );
    const levyContractModel = await getModel(
      "LevyContract",
      payservedb.LevyContract.schema,
      facilityId
    );
    const levyModel = await getModel(
      "Levy",
      payservedb.Levy.schema,
      facilityId
    );
    const levyTypeModel = await getModel(
      "LevyType",
      payservedb.LevyType.schema,
      facilityId
    );
    const unitModel = await getModel(
      "Unit",
      payservedb.Unit.schema,
      facilityId
    );

    // ── 2. Build invoice query ─────────────────────────────────────────────
    const invoiceQuery = {
      "facility.id": facilityId,
      "whatFor.invoiceType": "Contract",
    };

    // Year-month filtering
    if (yearMonth) {
      invoiceQuery.yearMonth = yearMonth;
    } else if (startYearMonth || endYearMonth) {
      invoiceQuery.yearMonth = {};
      if (startYearMonth) invoiceQuery.yearMonth.$gte = startYearMonth;
      if (endYearMonth) invoiceQuery.yearMonth.$lte = endYearMonth;
    }

    // Customer filter
    if (customerId) {
      invoiceQuery["client.clientId"] = customerId;
    }

    // Unit filter
    if (unitId) {
      invoiceQuery["unit.id"] = unitId;
    }

    // Status filter
    if (status) {
      invoiceQuery.status = status;
    }

    // ── 3. Fetch invoices ──────────────────────────────────────────────────
    const invoices = await invoiceModel
      .find(invoiceQuery)
      .sort({ yearMonth: 1, "client.lastName": 1 })
      .lean();

    if (invoices.length === 0) {
      return reply.code(200).send({
        success: true,
        data: [],
        summary: { total: 0 },
        message: "No invoices found for the selected filters",
      });
    }

    // ── 4. Batch-load levy contracts referenced by invoices ────────────────
    const levyContractIds = [
      ...new Set(
        invoices
          .map((inv) => inv.whatFor?.description)
          .filter(Boolean)
      ),
    ];

    const levyContracts = await levyContractModel
      .find({ _id: { $in: levyContractIds } })
      .lean();

    const levyContractMap = {};
    levyContracts.forEach((lc) => {
      levyContractMap[lc._id.toString()] = lc;
    });

    // ── 5. Batch-load levies ───────────────────────────────────────────────
    const levyIds = [...new Set(levyContracts.map((lc) => lc.levyId?.toString()).filter(Boolean))];
    const levies = await levyModel.find({ _id: { $in: levyIds } }).lean();

    const levyMap = {};
    levies.forEach((l) => {
      levyMap[l._id.toString()] = l;
    });

    // ── 6. Batch-load levy types ───────────────────────────────────────────
    const levyTypeIds = [
      ...new Set(levies.map((l) => l.levyType?.toString()).filter(Boolean)),
    ];

    // Filter by levyTypeId if provided
    const levyTypeQuery = { _id: { $in: levyTypeIds } };
    if (levyTypeId) levyTypeQuery._id = levyTypeId;

    const levyTypes = await levyTypeModel.find(levyTypeQuery).lean();

    const levyTypeMap = {};
    levyTypes.forEach((lt) => {
      levyTypeMap[lt._id.toString()] = lt;
    });

    // Build set of valid levy type IDs (for filtering if levyTypeId was specified)
    const validLevyTypeIds = new Set(levyTypes.map((lt) => lt._id.toString()));

    // ── 7. Enrich each invoice with full context ───────────────────────────
    const enrichedInvoices = [];

    for (const invoice of invoices) {
      const contractId = invoice.whatFor?.description;
      const levyContract = levyContractMap[contractId] || null;
      const levy = levyContract ? levyMap[levyContract.levyId?.toString()] : null;
      const levyType = levy ? levyTypeMap[levy.levyType?.toString()] : null;

      // If filtering by levyTypeId, skip invoices that don't match
      if (levyTypeId && (!levyType || !validLevyTypeIds.has(levyType._id?.toString()))) {
        continue;
      }

      enrichedInvoices.push({
        // Identity
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        yearMonth: invoice.yearMonth,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        status: invoice.status,

        // Customer
        customerName: `${invoice.client?.firstName || ""} ${invoice.client?.lastName || ""}`.trim(),
        customerFirstName: invoice.client?.firstName || "",
        customerLastName: invoice.client?.lastName || "",
        customerId: invoice.client?.clientId,

        // Unit
        unitName: invoice.unit?.name || "",
        unitId: invoice.unit?.id,

        // Levy context
        levyTypeName: levyType?.name || "Unknown",
        levyName: levy?.levyName || "",
        levyContractId: levyContract?._id || null,
        collectionFrequency: levy?.collectionFrequency || levyContract?.paymentFrequency || "",

        // Financials
        subTotal: invoice.subTotal || 0,
        taxAmount: invoice.tax || 0,
        taxRate: invoice.metadata?.taxRate || 0,
        balanceBroughtForward: invoice.balanceBroughtForward || 0,
        totalAmount: invoice.totalAmount || 0,
        amountPaid: invoice.amountPaid || 0,
        outstanding: (invoice.totalAmount || 0) - (invoice.amountPaid || 0),
        currency: invoice.currency?.code || "KES",

        // eTims status
        etimsStatus: invoice.txsync?.status || "not_synced",
        etimsReceiptNo: invoice.txsync?.receiptNo || null,
      });
    }

    // ── 8. Build summary stats ─────────────────────────────────────────────
    const summary = {
      total: enrichedInvoices.length,
      totalAmount: enrichedInvoices.reduce((s, i) => s + i.totalAmount, 0),
      totalPaid: enrichedInvoices.reduce((s, i) => s + i.amountPaid, 0),
      totalOutstanding: enrichedInvoices.reduce((s, i) => s + i.outstanding, 0),
      totalTax: enrichedInvoices.reduce((s, i) => s + i.taxAmount, 0),
      byStatus: {},
      byLevyType: {},
    };

    enrichedInvoices.forEach((inv) => {
      // By status
      if (!summary.byStatus[inv.status]) {
        summary.byStatus[inv.status] = { count: 0, amount: 0, paid: 0 };
      }
      summary.byStatus[inv.status].count++;
      summary.byStatus[inv.status].amount += inv.totalAmount;
      summary.byStatus[inv.status].paid += inv.amountPaid;

      // By levy type
      if (!summary.byLevyType[inv.levyTypeName]) {
        summary.byLevyType[inv.levyTypeName] = { count: 0, amount: 0, paid: 0 };
      }
      summary.byLevyType[inv.levyTypeName].count++;
      summary.byLevyType[inv.levyTypeName].amount += inv.totalAmount;
      summary.byLevyType[inv.levyTypeName].paid += inv.amountPaid;
    });

    return reply.code(200).send({
      success: true,
      filters: { yearMonth, startYearMonth, endYearMonth, customerId, unitId, levyTypeId, status },
      summary,
      data: enrichedInvoices,
    });
  } catch (error) {
    console.error("[exportLevyInvoices] Error:", error.message);
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

module.exports = exportLevyInvoices;