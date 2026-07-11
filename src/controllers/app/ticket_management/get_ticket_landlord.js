const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const GetTicketLandlord = async (request, reply) => {
    try {
        const {facilityId, customerId} = request.params;

        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        const unit = await unitModel.findOne({ tenantId: customerId });
        console.log("unit", unit);

        if (!unit) {
            return reply.code(404).send({ success: false, message: 'Unit not found for this tenant' });
        }

        const landlord = await payservedb.Customer.findOne({ _id: unit.homeOwnerId });
        console.log("landlord", landlord);

        if (!landlord) {
            return reply.code(404).send({ success: false, message: 'Landlord not found for this unit' });
        }

        return reply.code(200).send({
            success: true,
            landlord: {
                _id: landlord._id,
                firstName: landlord.firstName,
                lastName: landlord.lastName,
                phoneNumber: landlord.phoneNumber,
                email: landlord.email,
                unitNumber: unit.unitNumber
            }
        });

    }
    catch (err) {
        console.error('Error in getting tickets:', err);
        return reply.code(400).send({ error: err.message });
    }
}

module.exports = GetTicketLandlord;


