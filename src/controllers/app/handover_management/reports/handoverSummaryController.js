const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getHandoverSummaryReport = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { search, handoverType, status, startDate, endDate } = request.query;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required.'
            });
        }

        // Convert facilityId string to ObjectId
        const facilityObjectId = new mongoose.Types.ObjectId(facilityId);

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

        // Process handovers with customer and unit information
        const transformedHandovers = await Promise.all(handovers.map(async (handover) => {
            // Get customer information
            let customerInfo = null;
            try {
                if (handover.customerId) {
                    const customer = await customerModel.findById(handover.customerId).lean();
                    if (customer) {
                        customerInfo = {
                            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
                            email: customer.email,
                            phone: customer.phoneNumber
                        };
                    }
                }
            } catch (err) {
                console.error('Error fetching customer:', err);
            }

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

            // Filter by search if provided
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                const matchesCustomer = customerInfo && (
                    searchRegex.test(customerInfo.name) ||
                    searchRegex.test(customerInfo.email) ||
                    searchRegex.test(customerInfo.phone)
                );
                const matchesUnit = unitInfo && (
                    searchRegex.test(unitInfo.name) ||
                    searchRegex.test(unitInfo.floorUnitNo)
                );

                if (!matchesCustomer && !matchesUnit) {
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
                customerEmail: customerInfo?.email || 'N/A',
                customerPhone: customerInfo?.phone || 'N/A',
                handoverDate: handover.handoverDate,
                status: handover.status,
                totalItems: handover.items?.length || 0,
                electricMeter: handover.meterReadings?.electric?.reading || 'N/A',
                waterMeter: handover.meterReadings?.water?.reading || 'N/A',
                keys: handover.keys?.length || 0,
                hasDamages: handover.items?.some(item => item.condition === 'Damaged' || item.condition === 'Poor') || false,
                signed: !!(handover.signatures?.propertyManager?.signature && handover.signatures?.customer?.signature)
            };
        }));

        // Filter out null entries (from search)
        const filteredHandovers = transformedHandovers.filter(h => h !== null);

        // Compute summary statistics
        const summary = {
            totalHandovers: filteredHandovers.length,
            moveInCount: filteredHandovers.filter(h => h.handoverType === 'MoveIn').length,
            moveOutCount: filteredHandovers.filter(h => h.handoverType === 'MoveOut').length,
            completedCount: filteredHandovers.filter(h => h.status === 'Completed').length,
            pendingCount: filteredHandovers.filter(h => h.status === 'Pending').length,
            withDamages: filteredHandovers.filter(h => h.hasDamages).length,
            fullySigned: filteredHandovers.filter(h => h.signed).length
        };

        return reply.code(200).send({
            success: true,
            data: {
                handovers: filteredHandovers,
                summary
            }
        });

    } catch (err) {
        console.error('Error in getHandoverSummaryReport:', err.stack);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while generating the handover summary report.'
        });
    }
};

module.exports = getHandoverSummaryReport;
