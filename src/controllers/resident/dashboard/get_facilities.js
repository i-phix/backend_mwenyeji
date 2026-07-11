const payservedb = require('payservedb');

const get_facilities = async (request, reply) => {
    try {
        const { customerData } = request.user;

        // Use Promise.all to handle async operations in parallel
        const facilities = await Promise.all(
            customerData.map(async (item) => {
                let facility = await payservedb.Facility.findById(item.facilityId);
                let customer = await payservedb.Customer.findById(item.customerId);

                facility = facility.toObject(); // Convert Mongoose document to plain object
                facility.customerId = item.customerId;
                facility.customerNo = customer.customerNumber
                return facility;
            })
        );

        return reply.code(200).send(facilities);
    } catch (err) {
        return reply.code(502).send(err.message);
    }
};

module.exports = get_facilities;

// const payservedb = require('payservedb');
// const { getModel } = require('../../../utils/getModel');

// const get_facilities = async (request, reply) => {
//     try {
//         const { customerData } = request.user;

//         const facilities = await Promise.all(
//             customerData.map(async (item) => {
//                 // Use dynamic models for Facility and Customer
//                 const Facility = await getModel('Facility', payservedb.Facility.schema, item.facilityId);
//                 const Customer = await getModel('Customer', payservedb.Customer.schema, item.facilityId);

//                 let facility = await Facility.findById(item.facilityId);
//                 let customer = await Customer.findById(item.customerId);

//                 if (!facility || !customer) {
//                     return null; // Skip if data is missing
//                 }

//                 facility = facility.toObject(); // Convert Mongoose document to plain object
//                 facility.customerId = item.customerId;
//                 facility.customerNo = customer.customerNumber;

//                 return facility;
//             })
//         );

//         // Filter out null results in case some facility or customer data is missing
//         const filteredFacilities = facilities.filter(facility => facility !== null);

//         return reply.code(200).send(filteredFacilities);
//     } catch (err) {
//         console.error('Error fetching facilities:', err.message); // Log error for debugging
//         return reply.code(502).send({ error: err.message });
//     }
// };

// module.exports = get_facilities;

