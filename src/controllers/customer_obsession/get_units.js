const payservedb = require('payservedb');
const logger = require('../../../config/winston');
const { getModel } = require('../../utils/getModel');

async function get_units(request, reply) {
    try {
        const agent = request.user;
        const { facilityId } = request.params;

        // Validate facility exists and get dbName
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        console.log(`Facility found: ${facility.name}, dbName: ${facility.dbName}`);

        // Get the unit model for the facility database
        const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        // First, let's try to get all units to see what's in the database
        const allUnits = await UnitModel.find({});
        console.log(`Found ${allUnits.length} total units in facility database`);

        if (allUnits.length > 0) {
            console.log('Sample unit:', JSON.stringify(allUnits[0], null, 2));
        }

        // Try with facilityId if the units are linked to facility
        const unitsWithFacilityId = await UnitModel.find({ facilityId: facilityId });
        console.log(`Found ${unitsWithFacilityId.length} units with facilityId ${facilityId}`);

        // If no units found with facilityId, get all units (they might not have facilityId set)
        let units;
        if (unitsWithFacilityId.length > 0) {
            // Include all units except those that are explicitly disabled/deleted
            units = await UnitModel.find({
                facilityId: facilityId,
                status: { $nin: ['disabled', 'deleted', 'Disabled', 'Deleted', 'inactive', 'Inactive'] }
            });
        } else {
            // Get all units if facilityId filtering doesn't work (exclude disabled/deleted)
            units = await UnitModel.find({
                status: { $nin: ['disabled', 'deleted', 'Disabled', 'Deleted', 'inactive', 'Inactive'] }
            });
        }

        console.log(`Final units count: ${units.length}`);

        // Skip population for now to avoid cross-database schema issues
        // We'll send the raw units and let the frontend handle customer display
        const sortedUnits = units.sort((a, b) => {
            // Sort by floorUnitNo or name
            const aSort = a.floorUnitNo || a.name || '';
            const bSort = b.floorUnitNo || b.name || '';
            return aSort.localeCompare(bSort);
        });

        console.log(`Sorted units count: ${sortedUnits.length}`);

        logger.info(`Agent ${agent.agent?.agent_id} retrieved ${sortedUnits.length} units for facility ${facilityId}`);

        return reply.code(200).send({
            success: true,
            data: {
                units: sortedUnits,
                facility: {
                    _id: facility._id,
                    name: facility.name,
                    location: facility.location
                }
            }
        });

    } catch (error) {
        logger.error(`Error retrieving units: ${error.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve units'
        });
    }
}

module.exports = get_units;