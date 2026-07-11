const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_unit_lease_income = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;

        if (!facilityId || !unitId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Unit ID are required'
            });
        }

        // Get models for the specific facility
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);

        // Find the specific unit
        const unit = await unitModel.findById(unitId).lean();

        if (!unit) {
            return reply.code(404).send({
                success: false,
                error: 'Unit not found'
            });
        }

        // Ensure the unit has a tenant
        if (!unit.tenantId) {
            return reply.code(200).send({
                success: true,
                message: 'This unit is vacant. No lease income available.',
                unitId,
                unitName: unit.name,
                totalIncome: 0,
                totalPaid: 0,
                totalBalance: 0,
                invoices: []
            });
        }

        // Fetch lease invoices for this unit's tenant
        const invoices = await invoiceModel.find({
            'client.clientId': unit.tenantId,
            'whatFor.invoiceType': 'Lease'
        })
            .populate({
                path: 'client.clientId',
                model: payservedb.Customer,
                select: 'firstName lastName'
            })
            .lean();

        // Filter out voided invoices for calculations
        const activeInvoices = invoices.filter(invoice => {
            const status = invoice.status?.toLowerCase();
            return status !== 'void' && status !== 'voided';
        });

        // Calculate totals using only active (non-voided) invoices
        let totalIncome = activeInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        let totalPaid = activeInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
        let totalBalance = totalIncome - totalPaid;

        return reply.code(200).send({
            success: true,
            message: 'Unit lease income fetched successfully.',
            unitId,
            unitName: unit.name,
            totalIncome,
            totalPaid,
            totalBalance,
            invoices // Still return all invoices (including voided) for display
        });

    } catch (err) {
        console.error('Error in get_unit_lease_income:', err.message);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while fetching unit lease income.'
        });
    }
};

module.exports = get_unit_lease_income;