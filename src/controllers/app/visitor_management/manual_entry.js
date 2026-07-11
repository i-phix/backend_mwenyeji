const payservedb = require('payservedb');
const checkDistance = require('../../../utils/checkDistance');
const { getModel } = require("../../../utils/getModel");

const confirmManualEntry = async (request, reply) => {
    try {
        const { facilityId } = request.params
        const { uniqueCode, entry, entryPointId, lat, long } = request.body;

        const check_distance = await checkDistance(long, lat, entryPointId)

        // if (!check_distance) {
        //     throw new Error('You are far away from the entry point')
        // }

        if (!uniqueCode) throw new Error('Unique Code is required.');
        if (!entry) throw new Error('Entry Point is required.');

        let customer, visitor;

        const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);
        const visitLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);


        // Check if uniqueCode matches a family member
        const familyMember = await payservedb.Customer.findOne(
            { "familyMembers.no": uniqueCode, facilityId, "familyMembers.disabled": false },
            { "familyMembers.$": 1 }
        );

        if (familyMember && familyMember.familyMembers.length > 0) {
            const member = familyMember.familyMembers[0];
            const customer = await payservedb.Customer.findById(familyMember._id);
            const unit = await unitModel.findOne({ residentId: customer._id });
            // await logVisit(member.name, member._id, customer, entry, true);
            return reply.code(200).send({ member, customer, type: "Family Member", unitName: unit && unit.name });
        }

        // Check if uniqueCode matches a staff member
        const staffMember = await payservedb.Customer.findOne(
            { "staff.no": uniqueCode, facilityId, "staff.disabled": false },
            { "staff.$": 1 }
        );

        if (staffMember && staffMember.staff.length > 0) {
            const member = staffMember.staff[0];
            const customer = await payservedb.Customer.findById(staffMember._id);
            const unit = await unitModel.findOne({ residentId: customer._id });
            // await logVisit(member.name, member._id, customer, entry, true);
            return reply.code(200).send({ member, customer, type: "Staff", unitName: unit && unit.name });
        }

        // Check if uniqueCode matches a vehicle
        const vehicleData = await payservedb.Customer.findOne(
            { "vehicles.no": uniqueCode, facilityId, "vehicles.disabled": false },
            { "vehicles.$": 1, firstName: 1, lastName: 1, facilityId: 1 }
        );

        if (vehicleData && vehicleData.vehicles.length > 0) {
            const vehicle = vehicleData.vehicles[0];
            const customer = await payservedb.Customer.findById(vehicleData._id);
            const unit = await unitModel.findOne({ residentId: customer._id });
            // await logVisit(visitorName, vehicleData._id, vehicleData, entry, false, vehicle);
            return reply.code(200).send({ vehicle, vehicleData, customer, type: "Vehicle", unitName: unit && unit.name });
        }




        // Check if uniqueCode matches a resident
        const resident = await payservedb.Customer.findOne({ customerNumber: parseInt(uniqueCode), facilityId });
        if (resident) {
            const unit = await unitModel.findOne({ residentId: resident._id });
            // await logVisit(`${resident.firstName} ${resident.lastName}`, resident._id, resident, entry, false);
            return reply.code(200).send({ customer: resident, unit: resident.unit, type: "Resident", unitName: unit && unit.name });
        }
        const visitLog = await visitLogModel.findOne({ visitationCode: uniqueCode, facilityId });
        if (visitLog) {
            return reply.code(200).send({ visitLog, type: "Visitor" });

        }


        throw new Error('We couldn\'t find the record you were looking for. Please double-check the code and try again.');
    } catch (err) {
        console.error('Error in manual entry confirmation:', err.message);
        return reply.code(502).send({ error: err.message });
    }
};


const logVisit = async (visitorName, visitorId, customer, entry, isFamilyOrStaff, vehicleData = null, division) => {
    const visitLog = await visitLogModel.create({
        visitorName: visitorName,
        visitorId: visitorId,
        residentName: customer && `${customer.firstName} ${customer.lastName}`,
        residentId: customer && customer._id,
        houseNumber: '',
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
        qrCode: true,
        division: 'ofafa'
    });

    await visitLog.save();
};

module.exports = confirmManualEntry;
