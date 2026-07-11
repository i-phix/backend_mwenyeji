const payservedb = require('payservedb');
const checkDistance = require('../../../utils/checkDistance');
const { getModel } = require("../../../utils/getModel");

const confirm_qr_data = async (request, reply) => {
    try {
        const { facilityId } = request.params
        const { data, entry, entryPointId, lat, long } = request.body;

        const check_distance = await checkDistance(long, lat, entryPointId);

        // if (!check_distance) {
        //     throw new Error('You are far away from the Gate, Please move closer to the gate');
        // }
   

        const body = JSON.parse(data[0].rawValue);
        const { customerId, _id, type } = body;

        // Retrieve the customer by ID
        const customer = await payservedb.Customer.findById(customerId);
        if (!customer) {
            return reply.code(404).send({ error: 'Invalid QR Code' });
        }

        let result;
        const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);
        let unit = await unitModel.findOne({ residentId: customer._id });

        if (type === 'Family') {
            const familyMember = customer.familyMembers.find((x) => x._id.toString() === _id && !x.disabled);
            if (familyMember) {
                result = { type: "Family Member", member: familyMember, customer, unitName: unit?.name };
            }
        } else if (type === 'Staff') {
            const staffMember = customer.staff.find((x) => x._id.toString() === _id && !x.disabled);
            if (staffMember) {
                result = { type: "Staff", member: staffMember, customer, unitName: unit?.name };
            }
        } else if (type === 'Vehicle') {
            const vehicle = customer.vehicles.find((x) => x._id.toString() === _id && !x.disabled);
            if (vehicle) {
                result = { type: "Vehicle", vehicle, customer, unitName: unit?.name };
            }
        } else if (type === 'Customer') {
            result = { type: "Resident", customer, unitName: unit?.name };
        }

        if (result) {
            return reply.code(200).send(result);
        } else {
            throw new Error('Entry Denied');
        }
    } catch (err) {
       
        return reply.code(502).send({ error: err.message });
    }
};


module.exports = confirm_qr_data;
