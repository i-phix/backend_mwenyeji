const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { getModel } = require('../../../utils/getModel');

const getUnit = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const userType = request.user.type;
        const { unitId } = request.params;

        // Verify user is customer support agent
        if (userType !== 'Customer_Support') {
            return reply.code(403).send({
                success: false,
                error: 'Access denied. Customer Support agents only.'
            });
        }

        // We need to find which facility this unit belongs to
        // Try all facilities until we find the unit
        const facilities = await payservedb.Facility.find({}).lean();

        let unit = null;
        let facilityInfo = null;

        for (const facility of facilities) {
            try {
                const UnitModel = await getModel('Unit', payservedb.Unit.schema, facility._id.toString());
                const foundUnit = await UnitModel.findById(unitId).lean();

                if (foundUnit) {
                    unit = foundUnit;
                    facilityInfo = facility;
                    break;
                }
            } catch (err) {
                // Continue searching in other facilities
                continue;
            }
        }

        if (!unit) {
            return reply.code(404).send({
                success: false,
                error: 'Unit not found'
            });
        }

        // Fetch customer details if IDs are present (from the same facility database)
        const CustomerModel = await getModel('Customer', payservedb.Customer.schema, facilityInfo._id.toString());

        const homeOwner = unit.homeOwnerId ? await CustomerModel.findById(unit.homeOwnerId).lean() : null;
        const tenant = unit.tenantId ? await CustomerModel.findById(unit.tenantId).lean() : null;
        const resident = unit.residentId ? await CustomerModel.findById(unit.residentId).lean() : null;

        // Attach customer details and map facilityId to facility_id for frontend compatibility
        const unitDetails = {
            ...unit,
            facility_id: {
                _id: facilityInfo._id,
                name: facilityInfo.name,
                address: facilityInfo.address,
                company_id: facilityInfo.company_id
            },
            homeOwner: homeOwner ? {
                fullName: `${homeOwner.firstName || ''} ${homeOwner.lastName || ''}`.trim() || homeOwner.fullName,
                phoneNumber: homeOwner.phoneNumber,
                email: homeOwner.email,
                customerType: homeOwner.customerType
            } : null,
            tenant: tenant ? {
                fullName: `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || tenant.fullName,
                phoneNumber: tenant.phoneNumber,
                email: tenant.email,
                customerType: tenant.customerType
            } : null,
            resident: resident ? {
                fullName: `${resident.firstName || ''} ${resident.lastName || ''}`.trim() || resident.fullName,
                phoneNumber: resident.phoneNumber,
                email: resident.email,
                customerType: resident.customerType
            } : null
        };

        logger.info(`Agent ${userId} retrieved unit ${unitId}`);

        return reply.code(200).send({
            success: true,
            data: unitDetails
        });

    } catch (err) {
        logger.error(`Error fetching unit details: ${err.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve unit details'
        });
    }
};

module.exports = getUnit;
