const payservedb = require('payservedb');

const addResident = async (request, reply) => {
    try {
        const {
            residentId,
            name,
            email,
            phone,
            nationalId,
            unitId,
            unitName,
            facilityId,
            paymentFrequency,
            notificationPreferences,
            notes
        } = request.body;

        const existingResident = await payservedb.Resident.findOne({ residentId });
        if (existingResident) {
            return reply.code(409).send({ error: "Resident already exists" });
        }

        const resident = new payservedb.Resident({
            residentId,
            name,
            email,
            phone,
            nationalId,
            unitId,
            unitName,
            facilityId,
            paymentFrequency,
            notificationPreferences,
            notes
        });

        await resident.save();
        return reply.code(201).send({ message: 'Resident created successfully', resident });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return reply.code(400).send({ error: 'Validation Error', details: err.errors });
        }
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = addResident;
