const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_landlord_income = async (request, reply) => {
    try {
        const { facilityId, homeOwnerId } = request.params;

        if (!facilityId || !homeOwnerId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Homeowner ID are required'
            });
        }

        // Get models for the specific facility
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);

        // Find units owned by the non-resident homeowner
        const ownedUnits = await unitModel.find({
            homeOwnerId: homeOwnerId,  // ✅ Correct field name
            tenantId: { $ne: null } // Ensure the unit has a tenant
        }).lean();

        if (ownedUnits.length === 0) {
            return reply.code(200).send({
                success: true,
                message: 'No tenants found for this homeowner.',
                totalIncome: 0,
                invoices: []
            });
        }

        // Get all tenant IDs from the units
        const tenantIds = ownedUnits.map(unit => unit.tenantId);

        // Fetch lease invoices for these tenants
        const invoices = await invoiceModel.find({
            'client.clientId': { $in: tenantIds }, // Get invoices of tenants
            'whatFor.invoiceType': 'Lease'
        })
        .populate({
            path: 'client.clientId',
            model: payservedb.Customer,
            select: 'firstName lastName'
        })
        .lean();

        // Calculate totals
        let totalIncome = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        let totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
        let totalBalance = totalIncome - totalPaid;

        return reply.code(200).send({
            success: true,
            message: 'Landlord income fetched successfully.',
            totalIncome,
            totalPaid,
            totalBalance,
            invoices
        });
    } catch (err) {
        console.error('Error in get_landlord_income:', err.message);
        return reply.code(500).send({ 
            success: false,
            error: 'An error occurred while fetching landlord income.' 
        });
    }
};

module.exports = get_landlord_income;
