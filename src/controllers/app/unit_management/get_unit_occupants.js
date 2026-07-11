const payservedb = require('payservedb');
const { getModel } = require("../../../utils/getModel");
// const mongoose = require('mongoose');

const get_unit_occupants = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;
        const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);

        // Fetch the unit with focus on occupants
        const unit = await unitModel.findById(unitId);
        if (!unit) {
            return reply.code(404).send({ error: "Unit not found" });
        }

        // Return empty array if no occupants
        if (!unit.occupants || unit.occupants.length === 0) {
            return reply.code(200).send({
                unitName: unit.name,
                occupants: []
            });
        }

        // Get all customer IDs from occupants array to fetch in one query
        const customerIds = unit.occupants.map(occupant => occupant.customerId);
        const customers = await payservedb.Customer.find({
            _id: { $in: customerIds }
        });

        // Create a map for quick customer lookup
        const customerMap = {};
        customers.forEach(customer => {
            customerMap[customer._id.toString()] = customer;
        });

        // Enrich occupant data with customer information
        const enrichedOccupants = unit.occupants.map(occupant => {
            const customer = customerMap[occupant.customerId.toString()];

            if (!customer) {
                return {
                    ...occupant.toObject(),
                    customerDetails: null
                };
            }

            return {
                ...occupant.toObject(),
                customerDetails: {
                    fullName: `${customer.firstName} ${customer.lastName}`,
                    phoneNumber: customer.phoneNumber,
                    email: customer.email,
                    idNumber: customer.idNumber,
                    status: customer.status
                },
                isActive: occupant.moveOutDate === null
            };
        });

        // Sort by moveInDate (newest first) by default
        enrichedOccupants.sort((a, b) => new Date(b.moveInDate) - new Date(a.moveInDate));


        return reply.code(200).send({
            unitName: unit.name,
            unitId: unit._id,
            occupants: enrichedOccupants
        });
    } catch (err) {
        console.error("Error fetching unit occupants:", err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_unit_occupants;