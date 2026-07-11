const payservedb = require('payservedb');
const { getModel } = require("../../../utils/getModel");

const get_unit = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;
        const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);

        // Fetch the unit
        const unit = await unitModel.findById(unitId);

        if (!unit) {
            return reply.code(404).send({ error: "Unit not found" });
        }

        // Fetch customer details if IDs are present
        const homeOwner = unit.homeOwnerId ? await payservedb.Customer.findById(unit.homeOwnerId) : null;
        const tenant = unit.tenantId ? await payservedb.Customer.findById(unit.tenantId) : null;
        const resident = unit.residentId ? await payservedb.Customer.findById(unit.residentId) : null;

        // Attach customer details
        const unitDetails = {
            ...unit.toObject(),
            homeOwner: homeOwner ? {
                fullName: `${homeOwner.firstName} ${homeOwner.lastName}`,
                phoneNumber: homeOwner.phoneNumber,
                email: homeOwner.email,
                customerType: homeOwner.customerType
            } : null,
            tenant: tenant ? {
                fullName: `${tenant.firstName} ${tenant.lastName}`,
                phoneNumber: tenant.phoneNumber,
                email: tenant.email,
                customerType: tenant.customerType
            } : null
        };

        return reply.code(200).send(unitDetails);
    } catch (err) {
        console.error("Error fetching unit details:", err);
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = get_unit;
