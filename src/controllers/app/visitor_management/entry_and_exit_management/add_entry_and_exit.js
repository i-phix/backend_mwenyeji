const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const addAccess = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { name, location, purpose, latitude, longitude, range } = request.body;

        const entryExitModel = await getModel('EntryExit', payservedb.EntryExit.schema, facilityId);

        // Check if an access point with the same name and facility ID already exists
        const existingAccessPoint = await entryExitModel.findOne({ facilityId, name });

        if (existingAccessPoint) {
            return reply.code(409).send({ error: 'Access point with this name already exists in this facility' });
        }

        // Create a new entry/exit point document using the schema model
        const newAccessPoint = await entryExitModel.create({
            name,
            location,
            purpose,
            facilityId,
            disabled: false, // Initial state, assuming 'disabled' is false upon creation
            range,
            gps: {
                type: 'Point', // Set the type to 'Point' for geospatial indexing
                coordinates: [longitude, latitude] // Use [longitude, latitude] format
            }
        });

        // Save the new access point to the database
        await newAccessPoint.save();
        return reply.code(200).send({success: true, message: 'Entry/Exit point added successfully'});
    } catch (err) {
        console.error(err);
        return reply.code(502).send({ error: 'Failed to add entry/exit point: ' + err.message });
    }
};

module.exports = addAccess;
