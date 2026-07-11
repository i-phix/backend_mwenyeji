const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getInventoryComparisonReport = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { search, status, unitId } = request.query;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required.'
            });
        }

        // Get facility-specific models
        const handoverModel = await getModel('Handover', payservedb.Handover.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const customerModel = payservedb.Customer;

        // Build filter - only for units with both move-in and move-out
        let filter = { handoverType: 'MoveOut' };

        if (unitId) {
            filter.unitId = new mongoose.Types.ObjectId(unitId);
        }

        // Fetch all move-out handovers
        const moveOutHandovers = await handoverModel.find(filter)
            .sort({ handoverDate: -1 })
            .lean();

        // Process each move-out handover and find its corresponding move-in
        const comparisons = await Promise.all(moveOutHandovers.map(async (moveOut) => {
            // Find the related move-in handover
            let moveIn = null;
            if (moveOut.relatedHandoverId) {
                try {
                    moveIn = await handoverModel.findById(moveOut.relatedHandoverId).lean();
                } catch (err) {
                    console.error('Error fetching related handover:', err);
                }
            }

            // If no related handover, try to find the most recent move-in for this unit
            if (!moveIn && moveOut.unitId) {
                try {
                    moveIn = await handoverModel.findOne({
                        unitId: moveOut.unitId,
                        handoverType: 'MoveIn',
                        handoverDate: { $lt: moveOut.handoverDate }
                    })
                    .sort({ handoverDate: -1 })
                    .lean();
                } catch (err) {
                    console.error('Error finding move-in handover:', err);
                }
            }

            // Get unit information
            let unitInfo = null;
            try {
                if (moveOut.unitId) {
                    const unit = await unitModel.findById(moveOut.unitId).lean();
                    if (unit) {
                        unitInfo = {
                            name: unit.name || 'N/A',
                            floorUnitNo: unit.floorUnitNo || 'N/A'
                        };
                    }
                }
            } catch (err) {
                console.error('Error fetching unit:', err);
            }

            // Get customer information for move-out
            let customerInfo = null;
            try {
                if (moveOut.customerId) {
                    const customer = await customerModel.findById(moveOut.customerId).lean();
                    if (customer) {
                        customerInfo = {
                            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown'
                        };
                    }
                }
            } catch (err) {
                console.error('Error fetching customer:', err);
            }

            // Skip if no move-in found
            if (!moveIn) {
                return null;
            }

            // Compare items
            const moveInItems = moveIn.items || [];
            const moveOutItems = moveOut.items || [];

            // Create a map of move-in items
            const moveInItemsMap = {};
            moveInItems.forEach(item => {
                const key = `${item.category}_${item.name}`;
                moveInItemsMap[key] = item;
            });

            // Find differences
            const differences = [];
            moveOutItems.forEach(moveOutItem => {
                const key = `${moveOutItem.category}_${moveOutItem.name}`;
                const moveInItem = moveInItemsMap[key];

                if (moveInItem) {
                    // Item exists in both, compare condition
                    if (moveInItem.condition !== moveOutItem.condition) {
                        differences.push({
                            itemName: moveOutItem.name,
                            category: moveOutItem.category,
                            moveInCondition: moveInItem.condition,
                            moveOutCondition: moveOutItem.condition,
                            status: moveOutItem.condition === 'Damaged' || moveOutItem.condition === 'Poor' ? 'Deteriorated' : 'Changed',
                            moveInNotes: moveInItem.notes || '',
                            moveOutNotes: moveOutItem.notes || ''
                        });
                    }
                } else {
                    // Item only in move-out (newly added)
                    differences.push({
                        itemName: moveOutItem.name,
                        category: moveOutItem.category,
                        moveInCondition: 'Not Present',
                        moveOutCondition: moveOutItem.condition,
                        status: 'Added',
                        moveInNotes: '',
                        moveOutNotes: moveOutItem.notes || ''
                    });
                }
            });

            // Check for items in move-in but not in move-out (removed items)
            Object.keys(moveInItemsMap).forEach(key => {
                const moveInItem = moveInItemsMap[key];
                const foundInMoveOut = moveOutItems.some(item =>
                    `${item.category}_${item.name}` === key
                );
                if (!foundInMoveOut) {
                    differences.push({
                        itemName: moveInItem.name,
                        category: moveInItem.category,
                        moveInCondition: moveInItem.condition,
                        moveOutCondition: 'Not Present',
                        status: 'Missing',
                        moveInNotes: moveInItem.notes || '',
                        moveOutNotes: ''
                    });
                }
            });

            // Filter by status if provided
            let filteredDifferences = differences;
            if (status && status !== 'All') {
                filteredDifferences = differences.filter(d => d.status === status);
            }

            // Filter by search if provided
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                filteredDifferences = filteredDifferences.filter(d =>
                    searchRegex.test(d.itemName) ||
                    searchRegex.test(d.category) ||
                    searchRegex.test(unitInfo?.name || '') ||
                    searchRegex.test(customerInfo?.name || '')
                );
            }

            // Only return if there are differences
            if (filteredDifferences.length === 0) {
                return null;
            }

            return {
                id: moveOut._id,
                unitName: unitInfo?.name || 'N/A',
                floorUnitNo: unitInfo?.floorUnitNo || 'N/A',
                customerName: customerInfo?.name || 'N/A',
                moveInDate: moveIn.handoverDate,
                moveOutDate: moveOut.handoverDate,
                totalItems: moveInItems.length,
                differences: filteredDifferences,
                deteriorated: filteredDifferences.filter(d => d.status === 'Deteriorated').length,
                missing: filteredDifferences.filter(d => d.status === 'Missing').length,
                added: filteredDifferences.filter(d => d.status === 'Added').length
            };
        }));

        // Filter out null entries
        const filteredComparisons = comparisons.filter(c => c !== null);

        // Compute summary statistics
        const summary = {
            totalComparisons: filteredComparisons.length,
            totalDifferences: filteredComparisons.reduce((sum, c) => sum + c.differences.length, 0),
            totalDeteriorated: filteredComparisons.reduce((sum, c) => sum + c.deteriorated, 0),
            totalMissing: filteredComparisons.reduce((sum, c) => sum + c.missing, 0),
            totalAdded: filteredComparisons.reduce((sum, c) => sum + c.added, 0),
            avgDifferencesPerUnit: filteredComparisons.length > 0
                ? Math.round(filteredComparisons.reduce((sum, c) => sum + c.differences.length, 0) / filteredComparisons.length)
                : 0
        };

        return reply.code(200).send({
            success: true,
            data: {
                comparisons: filteredComparisons,
                summary
            }
        });

    } catch (err) {
        console.error('Error in getInventoryComparisonReport:', err.stack);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while generating the inventory comparison report.'
        });
    }
};

module.exports = getInventoryComparisonReport;
