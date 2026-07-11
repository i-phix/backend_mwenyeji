const payservedb = require('payservedb');

const update_nextofkin = async (request, reply) => {
    try {
        const { customerId, nextofkinId } = request.params;
        const kinToEdit = request.body; // receiving the full kin object directly

        // Build the dynamic update object
        const updateFields = {};
        if (kinToEdit.name !== undefined) updateFields['nextOfKin.$[elem].name'] = kinToEdit.name;
        if (kinToEdit.relationship !== undefined) updateFields['nextOfKin.$[elem].relationship'] = kinToEdit.relationship;
        if (kinToEdit.phoneNumber !== undefined) updateFields['nextOfKin.$[elem].phoneNumber'] = kinToEdit.phoneNumber;
        if (kinToEdit.email !== undefined) updateFields['nextOfKin.$[elem].email'] = kinToEdit.email;
        if (kinToEdit.canReceiveInvoice !== undefined) updateFields['nextOfKin.$[elem].canReceiveInvoice'] = kinToEdit.canReceiveInvoice;

        const result = await payservedb.Customer.updateOne(
            { _id: customerId },
            { $set: updateFields },
            {
                arrayFilters: [
                    { "elem._id": nextofkinId }
                ]
            }
        );

        return reply.code(200).send({
            success: true,
            message: 'Customer next of kin updated successfully',
            result
        });
    } catch (err) {
        console.error('Error updating customer next of kin:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_nextofkin;
