const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const compare_handovers = async (request, reply) => {
    try {
        const { facilityId, handoverId } = request.params;

        // Validate required fields
        if (!handoverId) {
            return reply.code(400).send({ 
                success: false,
                error: 'Handover ID is required.' 
            });
        }

        // Dynamically fetch models
        const handoverModel = await getModel('Handover', payservedb.Handover.schema, facilityId);
        
        try {
            const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
            console.log('Successfully got Unit model');
        } catch (unitModelError) {
            console.warn('Could not get Unit model:', unitModelError.message);
            // Continue without unit model, we'll handle this later
        }

        // Find the handover using lean() to get a plain object
        let handover = await handoverModel.findById(handoverId).lean();

        if (!handover) {
            return reply.code(404).send({ 
                success: false,
                error: `Handover with ID ${handoverId} does not exist.` 
            });
        }

        // Ensure it's a move-out handover
        if (handover.handoverType !== 'MoveOut') {
            return reply.code(400).send({ 
                success: false,
                error: 'Comparison is only available for Move-Out handovers.' 
            });
        }

        // Ensure it has a related move-in handover
        if (!handover.relatedHandoverId) {
            return reply.code(400).send({ 
                success: false,
                error: 'This Move-Out handover does not have a related Move-In handover to compare with.' 
            });
        }

        // Find the related move-in handover
        let moveInHandover = await handoverModel.findById(handover.relatedHandoverId).lean();
        
        if (!moveInHandover) {
            return reply.code(404).send({ 
                success: false,
                error: 'Related Move-In handover not found.' 
            });
        }

        // Add customer information
        try {
            if (handover.customerId) {
                const customer = await payservedb.Customer.findById(handover.customerId);
                if (customer) {
                    handover.customerInfo = {
                        firstName: customer.firstName,
                        lastName: customer.lastName,
                        email: customer.email,
                        phoneNumber: customer.phoneNumber
                    };
                }
            }

            if (moveInHandover.customerId) {
                const customer = await payservedb.Customer.findById(moveInHandover.customerId);
                if (customer) {
                    moveInHandover.customerInfo = {
                        firstName: customer.firstName,
                        lastName: customer.lastName,
                        email: customer.email,
                        phoneNumber: customer.phoneNumber
                    };
                }
            }
        } catch (customerError) {
            console.error('Error fetching customer data:', customerError);
        }

        // Add unit information
        try {
            if (handover.unitId) {
                const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
                const unit = await unitModel.findById(handover.unitId);
                if (unit) {
                    handover.unitInfo = {
                        name: unit.name,
                        floorUnitNo: unit.floorUnitNo,
                        unitType: unit.unitType,
                        division: unit.division
                    };
                }
            }
        } catch (unitError) {
            console.error('Error fetching unit data:', unitError);
        }

        // Define condition severity order for comparison
        const conditionSeverity = {
            'Excellent': 5,
            'Good': 4,
            'Fair': 3,
            'Poor': 2,
            'Damaged': 1,
            'Non-functional': 0
        };

        // Compare items between move-in and move-out
        const comparison = {
            missing: [],     // Items in move-in but not in move-out
            damaged: [],     // Items that deteriorated in condition
            improved: [],    // Items that improved in condition
            unchanged: [],   // Items with no condition change
            new: [],         // Items in move-out but not in move-in
            meterDifferences: {},
            keysDifference: 0,
            summary: {
                totalMoveInItems: moveInHandover.items?.length || 0,
                totalMoveOutItems: handover.items?.length || 0,
                missingCount: 0,
                damagedCount: 0,
                improvedCount: 0,
                unchangedCount: 0,
                newCount: 0
            }
        };

        // Handle the case where items might be undefined
        const moveInItems = moveInHandover.items || [];
        const moveOutItems = handover.items || [];

        // Check for missing or condition-changed items
        moveInItems.forEach(moveInItem => {
            const moveOutItem = moveOutItems.find(item => 
                item.name === moveInItem.name && 
                item.category === moveInItem.category
            );
            
            if (!moveOutItem) {
                comparison.missing.push(moveInItem);
                comparison.summary.missingCount++;
            } else if (moveOutItem.condition !== moveInItem.condition) {
                const moveInSeverity = conditionSeverity[moveInItem.condition] || 0;
                const moveOutSeverity = conditionSeverity[moveOutItem.condition] || 0;
                
                if (moveOutSeverity < moveInSeverity) {
                    // Condition deteriorated
                    comparison.damaged.push({
                        item: moveOutItem,
                        originalCondition: moveInItem.condition,
                        currentCondition: moveOutItem.condition,
                        severityChange: moveOutSeverity - moveInSeverity
                    });
                    comparison.summary.damagedCount++;
                } else {
                    // Condition improved
                    comparison.improved.push({
                        item: moveOutItem,
                        originalCondition: moveInItem.condition,
                        currentCondition: moveOutItem.condition,
                        severityChange: moveOutSeverity - moveInSeverity
                    });
                    comparison.summary.improvedCount++;
                }
            } else {
                // Condition unchanged
                comparison.unchanged.push({
                    item: moveOutItem,
                    condition: moveOutItem.condition
                });
                comparison.summary.unchangedCount++;
            }
        });

        // Check for new items (in move-out but not in move-in)
        moveOutItems.forEach(moveOutItem => {
            const moveInItem = moveInItems.find(item => 
                item.name === moveOutItem.name && 
                item.category === moveOutItem.category
            );
            
            if (!moveInItem) {
                comparison.new.push(moveOutItem);
                comparison.summary.newCount++;
            }
        });

        // Calculate meter differences
        const utilities = ['electricity', 'water', 'gas'];
        utilities.forEach(utility => {
            const moveInReading = moveInHandover.meterReadings?.[utility]?.reading;
            const moveOutReading = handover.meterReadings?.[utility]?.reading;
            
            if (moveInReading !== undefined && moveOutReading !== undefined) {
                const difference = moveOutReading - moveInReading;
                comparison.meterDifferences[utility] = {
                    moveInReading,
                    moveOutReading,
                    difference,
                    percentage: moveInReading > 0 ? (difference / moveInReading) * 100 : null
                };
            } else {
                comparison.meterDifferences[utility] = {
                    moveInReading: moveInReading || 0,
                    moveOutReading: moveOutReading || 0,
                    difference: null,
                    percentage: null
                };
            }
        });

        // Calculate keys difference
        const moveInKeys = moveInHandover.keysHandedOver || 0;
        const moveOutKeys = handover.keysHandedOver || 0;
        comparison.keysDifference = {
            moveInKeys,
            moveOutKeys,
            difference: moveOutKeys - moveInKeys
        };

        // Calculate total potential deductions based on missing and damaged items
        let potentialDeductions = 0;
        
        // For missing items, assume full replacement cost might be needed
        // This is just an example calculation - you would adjust this based on your business rules
        comparison.missing.forEach(item => {
            // Sample calculation - assuming a base cost of $50 per item
            potentialDeductions += 50 * (item.quantity || 1);
        });
        
        // For damaged items, calculate based on severity of damage
        comparison.damaged.forEach(damaged => {
            // Sample calculation - $10 per severity level drop
            const severityDrop = Math.abs(damaged.severityChange || 0);
            potentialDeductions += 10 * severityDrop * (damaged.item.quantity || 1);
        });
        
        comparison.potentialDeductions = potentialDeductions;
        
        // Add handover dates for duration calculation
        comparison.duration = {
            moveInDate: moveInHandover.handoverDate,
            moveOutDate: handover.handoverDate,
            days: handover.handoverDate && moveInHandover.handoverDate ? 
                  Math.round((new Date(handover.handoverDate) - new Date(moveInHandover.handoverDate)) / (1000 * 60 * 60 * 24)) : 
                  null
        };

        return reply.code(200).send({
            success: true,
            data: {
                moveInHandover,
                moveOutHandover: handover,
                comparison
            }
        });

    } catch (err) {
        console.error('Error in compare_handovers:', err);
        
        return reply.code(500).send({ 
            success: false,
            error: err.message || 'An error occurred while comparing handovers.'
        });
    }
};

module.exports = compare_handovers;