const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getCompletionMetricsReport = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { search, status, handoverType, startDate, endDate } = request.query;

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

        // Build filter
        let filter = {};

        if (handoverType && handoverType !== 'All Types') {
            filter.handoverType = handoverType;
        }

        if (status && status !== 'All Status') {
            filter.status = status;
        }

        if (startDate || endDate) {
            filter.handoverDate = {};
            if (startDate) {
                filter.handoverDate.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.handoverDate.$lte = new Date(endDate);
            }
        }

        // Fetch all handovers
        const handovers = await handoverModel.find(filter)
            .sort({ handoverDate: -1 })
            .lean();

        // Process handovers with completion metrics
        const metrics = await Promise.all(handovers.map(async (handover) => {
            // Get unit information
            let unitInfo = null;
            try {
                if (handover.unitId) {
                    const unit = await unitModel.findById(handover.unitId).lean();
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

            // Get customer information
            let customerInfo = null;
            try {
                if (handover.customerId) {
                    const customer = await customerModel.findById(handover.customerId).lean();
                    if (customer) {
                        customerInfo = {
                            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown'
                        };
                    }
                }
            } catch (err) {
                console.error('Error fetching customer:', err);
            }

            // Calculate completion metrics
            const hasItems = (handover.items?.length || 0) > 0;
            const hasMeterReadings = !!(
                handover.meterReadings?.electric?.reading ||
                handover.meterReadings?.water?.reading ||
                handover.meterReadings?.gas?.reading
            );
            const hasKeys = (handover.keys?.length || 0) > 0;
            const hasSignatures = !!(
                handover.signatures?.propertyManager?.signature &&
                handover.signatures?.customer?.signature
            );
            const hasAttachments = (handover.attachments?.length || 0) > 0;

            // Calculate completion percentage
            const totalFields = 5; // items, meters, keys, signatures, attachments
            let completedFields = 0;
            if (hasItems) completedFields++;
            if (hasMeterReadings) completedFields++;
            if (hasKeys) completedFields++;
            if (hasSignatures) completedFields++;
            if (hasAttachments) completedFields++;

            const completionPercentage = Math.round((completedFields / totalFields) * 100);

            // Determine completion status
            let completionStatus = 'Incomplete';
            if (completionPercentage === 100) {
                completionStatus = 'Complete';
            } else if (completionPercentage >= 75) {
                completionStatus = 'Mostly Complete';
            } else if (completionPercentage >= 50) {
                completionStatus = 'Partially Complete';
            }

            // Check for missing fields
            const missingFields = [];
            if (!hasItems) missingFields.push('Items');
            if (!hasMeterReadings) missingFields.push('Meter Readings');
            if (!hasKeys) missingFields.push('Keys');
            if (!hasSignatures) missingFields.push('Signatures');
            if (!hasAttachments) missingFields.push('Attachments');

            // Filter by search if provided
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                const matchesUnit = unitInfo && (
                    searchRegex.test(unitInfo.name) ||
                    searchRegex.test(unitInfo.floorUnitNo)
                );
                const matchesCustomer = customerInfo && searchRegex.test(customerInfo.name);

                if (!matchesUnit && !matchesCustomer) {
                    return null;
                }
            }

            return {
                id: handover._id,
                handoverNumber: handover.handoverNumber || 'N/A',
                handoverType: handover.handoverType,
                unitName: unitInfo?.name || 'N/A',
                floorUnitNo: unitInfo?.floorUnitNo || 'N/A',
                customerName: customerInfo?.name || 'N/A',
                handoverDate: handover.handoverDate,
                status: handover.status,
                completionPercentage,
                completionStatus,
                hasItems,
                hasMeterReadings,
                hasKeys,
                hasSignatures,
                hasAttachments,
                missingFields,
                totalItems: handover.items?.length || 0,
                totalKeys: handover.keys?.length || 0,
                totalAttachments: handover.attachments?.length || 0
            };
        }));

        // Filter out null entries
        const filteredMetrics = metrics.filter(m => m !== null);

        // Compute summary statistics
        const summary = {
            totalHandovers: filteredMetrics.length,
            fullyComplete: filteredMetrics.filter(m => m.completionPercentage === 100).length,
            mostlyComplete: filteredMetrics.filter(m => m.completionPercentage >= 75 && m.completionPercentage < 100).length,
            partiallyComplete: filteredMetrics.filter(m => m.completionPercentage >= 50 && m.completionPercentage < 75).length,
            incomplete: filteredMetrics.filter(m => m.completionPercentage < 50).length,
            avgCompletionRate: filteredMetrics.length > 0
                ? Math.round(filteredMetrics.reduce((sum, m) => sum + m.completionPercentage, 0) / filteredMetrics.length)
                : 0,
            withItems: filteredMetrics.filter(m => m.hasItems).length,
            withMeterReadings: filteredMetrics.filter(m => m.hasMeterReadings).length,
            withKeys: filteredMetrics.filter(m => m.hasKeys).length,
            withSignatures: filteredMetrics.filter(m => m.hasSignatures).length,
            withAttachments: filteredMetrics.filter(m => m.hasAttachments).length,
            mostCommonMissingField: getMostCommonMissingField(filteredMetrics)
        };

        return reply.code(200).send({
            success: true,
            data: {
                metrics: filteredMetrics,
                summary
            }
        });

    } catch (err) {
        console.error('Error in getCompletionMetricsReport:', err.stack);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while generating the completion metrics report.'
        });
    }
};

// Helper function to find the most common missing field
function getMostCommonMissingField(metrics) {
    const fieldCounts = {
        'Items': 0,
        'Meter Readings': 0,
        'Keys': 0,
        'Signatures': 0,
        'Attachments': 0
    };

    metrics.forEach(metric => {
        metric.missingFields.forEach(field => {
            if (fieldCounts[field] !== undefined) {
                fieldCounts[field]++;
            }
        });
    });

    // Find the field with the highest count
    let maxCount = 0;
    let mostCommon = 'None';
    Object.keys(fieldCounts).forEach(field => {
        if (fieldCounts[field] > maxCount) {
            maxCount = fieldCounts[field];
            mostCommon = field;
        }
    });

    return maxCount > 0 ? mostCommon : 'None';
}

module.exports = getCompletionMetricsReport;
