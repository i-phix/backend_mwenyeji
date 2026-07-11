const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const allowEntry = async (request, reply) => {
    try {
        const { customer, visitor } = request.body;

        if (!customer || !customer.id || !customer.name) {
            throw new Error('Customer details are incomplete.');
        }

        const visitLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, customer.facilityId);

        // Fetch full customer details if `firstName`, `lastName`, or `facilityId` are missing
        let fullCustomer = customer;
        if (!customer.firstName || !customer.lastName || !customer.facilityId) {
            fullCustomer = await payservedb.Customer.findById(customer.id, 'firstName lastName facilityId');
            if (!fullCustomer) {
                throw new Error('Unable to find full customer details.');
            }
        }

        const visitorName = visitor?.name || 'Visitor';

        // Call logVisit with complete `fullCustomer` data
        await logVisit(visitorName, customer.id, fullCustomer, 'entry', true, visitor);

        return reply.code(200).send({ success: true, message: 'Entry granted successfully' });
    } catch (err) {
        console.error('Error in granting entry:', err.message);
        return reply.code(502).send({ error: err.message });
    }
};


const logVisit = async (visitorName, visitorId, customer, entry, isFamilyOrStaff, vehicleData = null) => {
    const visitLog = await visitLogModel.create({
        visitorName: visitorName,
        visitorId: visitorId,
        residentName: customer && `${customer.firstName || ''} ${customer.lastName || ''}`,
        residentId: customer && customer._id,
        houseNumber: '',
        division: 'ofafa',
        entryPoint: entry,
        exitPoint: "",
        startTime: new Date(),
        endTime: "",
        status: "Checked In",
        vehicle: isFamilyOrStaff ? null : {
            registration: vehicleData ? vehicleData.plateNumber : '',
            make: vehicleData ? vehicleData.name : '',
            color: vehicleData ? vehicleData.color : '',
            occupants: 1,
        },
        facilityId: customer.facilityId,
        qrCode: true
    });

    await visitLog.save();
};


module.exports = allowEntry;
