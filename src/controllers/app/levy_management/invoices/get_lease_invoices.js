const payservedb = require("payservedb");
const { getModel } = require("../../../../utils/getModel");

const getFacilityLeaseInvoices = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const invoiceModel = await getModel("Invoice", payservedb.Invoice.schema, facilityId);
    const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);

    const leaseInvoices = await invoiceModel.find({
      "whatFor.invoiceType": "Lease",
      "facility.id": facilityId
    })
      .select({
        invoiceNumber: 1,
        unit: 1,
        totalAmount: 1,
        amountPaid: 1,
        overpay: 1,
        issueDate: 1,
        dueDate: 1,
        status: 1,
        whatFor: 1,
        penalty: 1,
        createdAt: 1,
        currency: 1,
        yearMonth: 1,
        balanceBroughtForward: 1,
        subTotal: 1,
        tax: 1,
        items: 1,
        client: 1,
         notificationsSent: 1
      })
      .lean();

    if (!leaseInvoices.length) {
      return reply.code(200).send({
        success: true,
        message: "No lease invoices found",
        data: []
      });
    }

    const unitIds = leaseInvoices.map(invoice => invoice.unit.id);
    const units = await unitModel.find({ _id: { $in: unitIds } })
      .populate({
        path: 'tenantId',
        model: payservedb.Customer,
        select: 'firstName lastName phoneNumber email customerType'
      })
      .lean();

    const unitMap = units.reduce((map, unit) => {
      map[unit._id.toString()] = unit;
      return map;
    }, {});

    const invoicesWithTenantInfo = leaseInvoices.map(invoice => {
      const unit = unitMap[invoice.unit.id.toString()];
      const tenant = unit?.tenantId;

      if (!invoice.currency) {
        invoice.currency = {
          code: 'KES',
          name: 'Kenyan Shilling'
        };
      }

      let customerInfo;
      if (tenant) {
        customerInfo = {
          fullName: `${tenant.firstName} ${tenant.lastName}`,
          firstName: tenant.firstName,
          lastName: tenant.lastName,
          customerId: tenant._id,
          customerType: tenant.customerType,
          email: tenant.email,
          phoneNumber: tenant.phoneNumber
        };
      } else if (invoice.client && invoice.client.firstName && invoice.client.lastName) {
        customerInfo = {
          fullName: `${invoice.client.firstName} ${invoice.client.lastName}`,
          firstName: invoice.client.firstName,
          lastName: invoice.client.lastName,
          customerId: invoice.client.clientId,
          customerType: 'tenant',
          email: '',
          phoneNumber: ''
        };
      } else {
        customerInfo = {
          fullName: 'No Tenant Assigned',
          firstName: '',
          lastName: '',
          customerId: null,
          customerType: '',
          email: '',
          phoneNumber: ''
        };
      }

      return {
        ...invoice,
        customerInfo,
        balance: invoice.totalAmount - (invoice.amountPaid || 0)
      };
    });

    return reply.code(200).send({
      success: true,
      message: "Lease invoices retrieved successfully",
      data: invoicesWithTenantInfo
    });
  } catch (error) {
    console.error("Error occurred while fetching lease invoices:", error.message);
    return reply.code(500).send({
      success: false,
      message: error.message || "An error occurred while fetching lease invoices"
    });
  }
};

module.exports = getFacilityLeaseInvoices;