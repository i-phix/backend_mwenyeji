const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getMeterReadingsReport = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { search, meterType, unitId, startDate, endDate } = request.query;

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

        if (unitId) {
            filter.unitId = new mongoose.Types.ObjectId(unitId);
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

        // Fetch all handovers with meter readings
        const handovers = await handoverModel.find(filter)
            .sort({ handoverDate: -1 })
            .lean();

        // Process handovers with meter readings
        const meterReadings = await Promise.all(handovers.map(async (handover) => {
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

            // Extract meter readings
            const electricReading = handover.meterReadings?.electric?.reading;
            const waterReading = handover.meterReadings?.water?.reading;
            const gasReading = handover.meterReadings?.gas?.reading;

            // Filter by meter type if provided
            if (meterType && meterType !== 'All') {
                if (meterType === 'Electric' && !electricReading) return null;
                if (meterType === 'Water' && !waterReading) return null;
                if (meterType === 'Gas' && !gasReading) return null;
            }

            // Skip if no meter readings at all
            if (!electricReading && !waterReading && !gasReading) {
                return null;
            }

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
                electricReading: electricReading || 0,
                electricUnit: handover.meterReadings?.electric?.unit || 'kWh',
                electricPhoto: handover.meterReadings?.electric?.photo || null,
                waterReading: waterReading || 0,
                waterUnit: handover.meterReadings?.water?.unit || 'm³',
                waterPhoto: handover.meterReadings?.water?.photo || null,
                gasReading: gasReading || 0,
                gasUnit: handover.meterReadings?.gas?.unit || 'm³',
                gasPhoto: handover.meterReadings?.gas?.photo || null,
                hasElectric: !!electricReading,
                hasWater: !!waterReading,
                hasGas: !!gasReading
            };
        }));

        // Filter out null entries
        const filteredReadings = meterReadings.filter(r => r !== null);

        // Group readings by unit to calculate consumption
        const unitReadingsMap = {};
        filteredReadings.forEach(reading => {
            const unitKey = reading.unitName;
            if (!unitReadingsMap[unitKey]) {
                unitReadingsMap[unitKey] = [];
            }
            unitReadingsMap[unitKey].push(reading);
        });

        // Calculate consumption for units with both move-in and move-out
        const consumptionData = [];
        Object.keys(unitReadingsMap).forEach(unitKey => {
            const readings = unitReadingsMap[unitKey];
            // Sort by date
            readings.sort((a, b) => new Date(a.handoverDate) - new Date(b.handoverDate));

            // Find move-in and move-out pairs
            for (let i = 0; i < readings.length - 1; i++) {
                const moveIn = readings[i];
                const moveOut = readings[i + 1];

                if (moveIn.handoverType === 'MoveIn' && moveOut.handoverType === 'MoveOut') {
                    consumptionData.push({
                        unitName: unitKey,
                        customerName: moveOut.customerName,
                        moveInDate: moveIn.handoverDate,
                        moveOutDate: moveOut.handoverDate,
                        electricConsumption: moveOut.electricReading - moveIn.electricReading,
                        waterConsumption: moveOut.waterReading - moveIn.waterReading,
                        gasConsumption: moveOut.gasReading - moveIn.gasReading
                    });
                }
            }
        });

        // Compute summary statistics
        const summary = {
            totalReadings: filteredReadings.length,
            moveInReadings: filteredReadings.filter(r => r.handoverType === 'MoveIn').length,
            moveOutReadings: filteredReadings.filter(r => r.handoverType === 'MoveOut').length,
            unitsWithElectric: filteredReadings.filter(r => r.hasElectric).length,
            unitsWithWater: filteredReadings.filter(r => r.hasWater).length,
            unitsWithGas: filteredReadings.filter(r => r.hasGas).length,
            avgElectricReading: filteredReadings.length > 0
                ? Math.round(filteredReadings.reduce((sum, r) => sum + r.electricReading, 0) / filteredReadings.length)
                : 0,
            avgWaterReading: filteredReadings.length > 0
                ? Math.round(filteredReadings.reduce((sum, r) => sum + r.waterReading, 0) / filteredReadings.length)
                : 0,
            totalElectricConsumption: consumptionData.reduce((sum, c) => sum + c.electricConsumption, 0),
            totalWaterConsumption: consumptionData.reduce((sum, c) => sum + c.waterConsumption, 0)
        };

        return reply.code(200).send({
            success: true,
            data: {
                readings: filteredReadings,
                consumption: consumptionData,
                summary
            }
        });

    } catch (err) {
        console.error('Error in getMeterReadingsReport:', err.stack);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while generating the meter readings report.'
        });
    }
};

module.exports = getMeterReadingsReport;
