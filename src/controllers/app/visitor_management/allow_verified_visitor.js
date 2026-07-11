const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const allow_verified_visitor = async (request, reply) => {
    try {
        const { facilityId } = request.params
        const { type, vehicle, customer, visitLog, member, entry, unitName, guardId } = request.body;
        
        if (!type) throw new Error('Type is required.');

        const visitLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);

        if (type === 'Family Member') {
            await logVisit(visitLogModel, member.name, member._id, customer, entry, true, null, unitName, guardId);
            return reply.code(200).send('Successfully Saved');
        }
        else if (type === 'Staff') {
            await logVisit(visitLogModel, member.name, member._id, customer, entry, true, null, unitName, guardId);
            return reply.code(200).send('Successfully Saved');
        }
        else if (type === 'Vehicle') {
            const visitorName = `${vehicle.name} ${vehicle.model}`;
            await logVisit(visitLogModel, visitorName, vehicle._id, customer, entry, false, vehicle, unitName, guardId);
            return reply.code(200).send('Successfully Saved');
        }
        else if (type === 'Resident') {
            await logVisit(visitLogModel, `${customer.firstName} ${customer.lastName}`, customer._id, customer, entry, false, null, unitName, guardId);
            return reply.code(200).send('Successfully Saved');
        }
        else if (type === 'Visitor') {
            let query = {
                _id: visitLog._id
            }
            let data = {
                status: "Checked In",
                entryPoint: entry,
                startTime:new Date().toLocaleString(),
                visitationCode: null,
                guardId
            }
            await visitLogModel.updateOne(query, data);
            return reply.code(200).send('Successfully Saved');
        }
        else {
            throw new Error('Type is invalid')
        }

    } catch (err) {
        console.error('Error in manual entry confirmation:', err.message);
        return reply.code(502).send({ error: err.message });
    }
};

// Updated logVisit function without the type parameter
const logVisit = async (visitLogModel, visitorName, visitorId, customer, entry, isFamilyOrStaff, vehicleData, unitName, guardId) => {
    const visitLog = await visitLogModel.create({
        visitorName: visitorName,
        visitorId: visitorId,
        residentName: customer && `${customer.firstName} ${customer.lastName}`,
        residentId: customer && customer._id,
        houseNumber: unitName,
        entryPoint: entry,
        exitPoint: "",
        startTime: new Date().toLocaleString(),
        endTime: "",
        status: "Checked In",
        vehicle: isFamilyOrStaff ? null : {
            registration: vehicleData ? vehicleData.plateNumber : '',
            make: vehicleData ? vehicleData.name : '',
            color: vehicleData ? vehicleData.color : '',
            occupants: 1,
        },
        guardId,
        facilityId: customer.facilityId,
        qrCode: true
    });

    await visitLog.save();
};

module.exports = allow_verified_visitor;
