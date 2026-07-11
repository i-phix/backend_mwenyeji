const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_facility_units = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Retrieve the tenant-specific Unit model
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        // Retrieve the tenant-specific Invoice model
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);

        // Query units for the specific facility
        const units = await unitModel.find({ facilityId });

        // Filter occupied and non-occupied units
        const occupiedUnits = units.filter(
            (unit) => unit.homeOwnerId && unit.residentId && unit.tenantId
        );

        const occupiedByHomeowner = units.filter(
            (unit) => unit.homeOwnerId && unit.residentId && !unit.tenantId
        );

        const homeOwnerUnitsWithNoTenant = units.filter(
            (unit) => unit.homeOwnerId && !unit.residentId && !unit.tenantId
        );

        const notOccupiedUnits = units.filter(
            (unit) =>
                (!unit.homeOwnerId && !unit.residentId && !unit.tenantId) || // No IDs at all
                (unit.homeOwnerId && !unit.residentId && !unit.tenantId)    // Only homeOwnerId
        );

        // Query invoices to find units with Levy and Lease types
        const levyInvoices = await invoiceModel.distinct('unit.id', {
            'facility.id': facilityId,
            'whatFor.invoiceType': 'Levy'
        });

        const leaseInvoices = await invoiceModel.distinct('unit.id', {
            'facility.id': facilityId,
            'whatFor.invoiceType': 'Lease'
        });

        // Count unique units with levy and lease invoices
        const unitsWithLevy = levyInvoices.length;
        const unitsWithLease = leaseInvoices.length;

        // Return the results
        return reply.code(200).send({
            units,
            occupiedUnits,
            notOccupiedUnits,
            occupiedByHomeowner,
            homeOwnerUnitsWithNoTenant,
            unitsWithLevy,
            unitsWithLease
        });
    } catch (err) {
        console.error('Error in get_facility_units:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_facility_units;