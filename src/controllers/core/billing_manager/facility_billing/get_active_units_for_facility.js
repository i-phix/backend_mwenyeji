const payservedb = require("payservedb");
const { getModel } = require("../../../../utils/getModel");

const get_active_units_for_facility = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const unitModel = await getModel(
            "Unit",
            payservedb.Unit.schema,
            facilityId,
        );

        // Retrieve the tenant-specific Invoice model
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);

        // Get all units for the facility
        const units = await unitModel.find({ facilityId });

        // Query invoices to find units with Contract and Lease types
        const contractInvoices = await invoiceModel.distinct('unit.id', {
            'facility.id': facilityId,
            'whatFor.invoiceType': 'Contract'
        });

        const leaseInvoices = await invoiceModel.distinct('unit.id', {
            'facility.id': facilityId,
            'whatFor.invoiceType': 'Lease'
        });

        // Get all unit IDs that have invoices (active units)
        const allInvoiceUnitIds = await invoiceModel.distinct('unit.id', {
            'facility.id': facilityId
        });

        // Filter active units (units that have invoices)
        const activeUnits = units.filter(unit =>
            allInvoiceUnitIds.some(invoiceUnitId =>
                invoiceUnitId.toString() === unit._id.toString()
            )
        );

        // Count unique units with contract and lease invoices
        const unitsWithContract = contractInvoices.length;
        const unitsWithLease = leaseInvoices.length;

        return reply.code(200).send({
            units: activeUnits,
            unitsWithContract,
            unitsWithLease,
            totalActiveUnits: activeUnits.length
        });
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_active_units_for_facility;