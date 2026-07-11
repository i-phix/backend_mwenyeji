const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const DeactivateLandlord = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { customerId, unitIds } = request.body;

        const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);

        const ownedUnits = await unitModel.find({
            homeOwnerId: customerId
        });

        if (ownedUnits.length === 0) {
            return reply.code(404).send({
                error: "Customer is not attached to any units as homeowner"
            });
        }

        /* ---------------------------------------------------
           3. Validate that all requested unitIds belong to this customer
        --------------------------------------------------- */
        const ownedUnitIds = ownedUnits.map(u => u._id.toString());
        const invalidUnits = unitIds.filter(id => !ownedUnitIds.includes(id.toString()));

        if (invalidUnits.length > 0) {
            return reply.code(400).send({
                error: "Some units do not belong to this homeowner",
                invalidUnits
            });
        }

        /* ---------------------------------------------------
           4. Determine if we're removing ALL units or partial
        --------------------------------------------------- */
        const removingAllUnits = unitIds.length === ownedUnits.length;

        /* ---------------------------------------------------
           5. Remove homeowner from selected units
        --------------------------------------------------- */
        const updateResult = await unitModel.updateMany(
            {
                _id: { $in: unitIds },
                homeOwnerId: customerId
            },
            {
                $set: { homeOwnerId: null }
            }
        );


        let customerStatusUpdated = false;

        /* ---------------------------------------------------
           6. If removing ALL units → deactivate customer
        --------------------------------------------------- */
        if (removingAllUnits) {
            const customer = await payservedb.Customer.findById(customerId);

            if (customer) {
                customer.status = 'Inactive';
                await customer.save();
                customerStatusUpdated = true;
            }
        }

        /* ---------------------------------------------------
           8. Calculate remaining units after removal
        --------------------------------------------------- */
        const remainingUnits = ownedUnits.length - unitIds.length;

        /* ---------------------------------------------------
           9. Final Response
        --------------------------------------------------- */
        return reply.code(201).send({
            success: true,
            message: customerStatusUpdated
                ? "Landlord removed from all units and deactivated"
                : `Landlord removed from ${unitIds.length} unit(s)`,
            data: {
                customerId,
                totalUnits: ownedUnits.length,
                removedFromUnits: unitIds.length,
                remainingUnits,
                customerStatusUpdated,
                unitsModified: updateResult.modifiedCount
            }
        });

    } catch (err) {
        console.error("Error deactivating landlord:", err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = DeactivateLandlord;