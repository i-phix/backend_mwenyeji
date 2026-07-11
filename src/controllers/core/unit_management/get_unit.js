const payservedb = require('payservedb')
const { getModel } = require('../../../utils/getModel');
const get_unit = async (request, reply) => {
    try {
        const { unitId, facilityId } = request.params;
        const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId)

        const unit = await UnitModel.findById(unitId);

        const homeOwner = unit.homeOwnerId ? await payservedb.Customer.findById(unit.homeOwnerId) : null;
        const tenant = unit.tenantId ? await payservedb.Customer.findById(unit.tenantId) : null;
        const resident = unit.residentId ? await payservedb.Customer.findById(unit.residentId) : null;

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
            } : null,
            resident: resident ? {
                fullName: `${resident.firstName} ${resident.lastName}`,
                phoneNumber: resident.phoneNumber,
                email: resident.email,
                customerType: resident.customerType
            } : null
        };
        return reply.code(200).send(unitDetails);


    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = get_unit