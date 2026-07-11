const payservedb = require('payservedb');
const { getModel } = require("../../../utils/getModel");

const toggle_homeowner_type = async (request, reply) => {
    try {
        const { customerId, facilityId } = request.params;

        // Fetch the customer record
        const customer = await payservedb.Customer.findOne({ _id: customerId, facilityId });

        if (!customer) {
            return reply.code(404).send({ success: false, error: 'Customer not found' });
        }

        // Only home owners can be toggled
        if (customer.customerType !== 'home owner') {
            return reply.code(400).send({ success: false, error: 'Only home owners can have their type toggled' });
        }

        const isCurrentlyNonResident = customer.residentType === 'non-resident'; // currently a landlord
        const newResidentType = isCurrentlyNonResident ? 'resident' : 'non-resident';
        const newUserType    = isCurrentlyNonResident ? 'Resident' : 'Landlord';

        // 1. Update customer record
        await payservedb.Customer.updateOne(
            { _id: customerId },
            { $set: { residentType: newResidentType } }
        );

        // 2. Update user record
        await payservedb.User.updateOne(
            { 'customerData.customerId': customerId },
            { $set: { type: newUserType } }
        );

        // 3. Update the unit that has this customer as homeOwner
        const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);
        const unit = await unitModel.findOne({ homeOwnerId: customerId, facilityId });

        if (unit) {
            let unitUpdate;

            if (isCurrentlyNonResident) {
                // Landlord → Resident Homeowner: set residentId = homeOwnerId
                unitUpdate = { $set: { residentId: customerId } };
            } else {
                // Resident Homeowner → Landlord: remove residentId
                // Only unset residentId if it currently points to this homeowner
                // (guard: don't unset if a tenant is the residentId)
                const residentIdStr = unit.residentId ? unit.residentId.toString() : null;
                const homeOwnerIdStr = customerId.toString();

                if (residentIdStr === homeOwnerIdStr) {
                    unitUpdate = { $unset: { residentId: "" } };
                }
            }

            if (unitUpdate) {
                await unitModel.updateOne({ _id: unit._id, facilityId }, unitUpdate);
            }
        }

        return reply.code(200).send({
            success: true,
            message: `Customer successfully changed to ${isCurrentlyNonResident ? 'Resident Homeowner' : 'Landlord'}`,
            data: {
                customerId,
                newResidentType,
                newUserType
            }
        });

    } catch (err) {
        console.error('Error toggling homeowner type:', err);
        return reply.code(502).send({ success: false, error: err.message });
    }
};

module.exports = toggle_homeowner_type;