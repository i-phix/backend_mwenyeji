const utilityDb = require('../../../../middlewares/utilityDb');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const path = require('path');

const importAnalogMeterReadings = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Access the file uploaded by multer
        const file = request.file;
        if (!file) {
            return reply.code(400).send({ error: 'No file uploaded' });
        }

        // Check file extension
        const fileExt = path.extname(file.originalname).toLowerCase();
        if (fileExt !== '.csv') {
            fs.unlinkSync(file.path);
            return reply.code(400).send({ error: 'Only CSV files are allowed' });
        }

        // Parse CSV file
        const fileContent = fs.readFileSync(file.path, 'utf8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        // Get models from utility database
        const analogMeterModel = await utilityDb.getModel('WaterMeter');
        const analogBillingModel = await utilityDb.getModel('AnalogBilling');
        const DailyWaterMeterHistoryModel = await utilityDb.getModel('DailyWaterMeterHistory');
        const SingleDayWaterMeterHistoryModel = await utilityDb.getModel('SingleDayWaterMeterHistory');
        const MonthlyWaterMeterHistoryModel = await utilityDb.getModel('MonthlyWaterMeterHistory');

        // Process each record
        const results = {
            success: 0,
            updated: 0,
            errors: []
        };

        for (const record of records) {
            try {
                // Validate required fields (serial_number is the meterNumber)
                const { serial_number, meter_reading, year_month } = record;
                if (!serial_number || !meter_reading || !year_month) {
                    const errorMsg = 'Missing required fields (serial_number, meter_reading, or year_month)';
                    results.errors.push({
                        row: record,
                        error: errorMsg
                    });
                    continue;
                }

                // Find the meter using serial_number as meterNumber
                const meter = await analogMeterModel.findOne({
                    meterNumber: serial_number,
                    facilityId
                });

                if (!meter) {
                    const errorMsg = `Meter with meterNumber ${serial_number} not found`;
                    results.errors.push({
                        row: record,
                        error: errorMsg
                    });
                    continue;
                }

                // Convert meter_reading to number
                const currentReading = parseFloat(meter_reading);
                if (isNaN(currentReading)) {
                    const errorMsg = 'Invalid meter reading value';
                    results.errors.push({
                        row: record,
                        error: errorMsg
                    });
                    continue;
                }

                // Get previous reading from the meter's current reading (like in updateMeterReading)
                const previousReading = meter.currentReading;

                // Validate that current reading is not less than previous reading
                if (currentReading < previousReading) {
                    const errorMsg = `Current reading (${currentReading}) cannot be less than previous reading (${previousReading}) for meter ${serial_number}`;
                    results.errors.push({
                        row: record,
                        error: errorMsg
                    });
                    continue;
                }

                // Validate year_month format (YYYY-MM)
                const yearMonthRegex = /^\d{4}-\d{2}$/;
                if (!yearMonthRegex.test(year_month)) {
                    const errorMsg = 'Invalid year_month format. Use YYYY-MM';
                    results.errors.push({
                        row: record,
                        error: errorMsg
                    });
                    continue;
                }

                // Calculate consumption (usage)
                const consumption = Math.round((currentReading - previousReading) * 100) / 100;

                // Get unit info properly - handle case where Unit model might not be available
                let unitName = 'Unknown';
                if (meter.unitId) {
                    try {
                        const unitModel = await utilityDb.getModel('Unit');
                        const unit = await unitModel.findById(meter.unitId);
                        if (unit && unit.name) {
                            unitName = unit.name;
                        }
                    } catch (unitError) {
                        // If Unit model is not available, use unit_name from CSV if provided
                        if (record.unit_name) {
                            unitName = record.unit_name;
                        }
                        console.warn('Unit model not available, using CSV unit_name or default');
                    }
                } else if (record.unit_name) {
                    // If no unitId but unit_name is provided in CSV, use that
                    unitName = record.unit_name;
                }

                const customerId = meter.customerId;
                const billingType = meter.customerType;
                const accountNumber = meter.accountNumber;

                // Check if a reading for this meter and month already exists
                const existingReading = await analogBillingModel.findOne({
                    meterNumber: serial_number,
                    yearMonth: year_month,
                    facilityId
                });

                const currentDate = new Date();

                // Format the date as YYYY-MM-DD string
                const dateString = currentDate.toISOString().split('T')[0];

                // Format the time as HH:MM string (not HH:MM:SS)
                const timeString = currentDate.toTimeString().split(' ')[0].substring(0, 5);

                if (existingReading) {
                    // Update existing reading instead of skipping
                    await analogBillingModel.findByIdAndUpdate(
                        existingReading._id,
                        {
                            currentReading,
                            previousReading,
                            totalUsage: Math.round(consumption * 100) / 100,
                            unitName,
                            status: 'pending' // Reset to pending since it's been updated
                        }
                    );

                    results.updated++;
                } else {
                    // Create the billing record with customerId
                    await analogBillingModel.create({
                        facilityId,
                        meterNumber: serial_number,
                        accountNumber: accountNumber,
                        currentReading,
                        previousReading,
                        yearMonth: year_month,
                        totalUsage: Math.round(consumption * 100) / 100,
                        unitName,
                        customerId,
                        billingType,
                        status: 'pending'
                    });

                    results.success++;
                }

                // Update the meter readings - FIXED: Use the same logic as updateMeterReading
                meter.previousReading = previousReading;
                meter.currentReading = currentReading;
                meter.lastReadingDate = currentDate;
                await meter.save();

                // Save to DailyWaterMeterHistory
                const today = new Date(currentDate);
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const existingDailyHistory = await DailyWaterMeterHistoryModel.findOne({
                    meterId: meter._id,
                    date: {
                        $gte: today,
                        $lt: tomorrow
                    }
                });

                if (existingDailyHistory) {
                    // Update existing daily history
                    existingDailyHistory.reading = currentReading;
                    await existingDailyHistory.save();
                } else {
                    // Create new daily history
                    await DailyWaterMeterHistoryModel.create({
                        meterId: meter._id,
                        date: today,
                        reading: currentReading
                    });
                }

                // Save to SingleDayWaterMeterHistory with correct format
                await SingleDayWaterMeterHistoryModel.create({
                    meterId: meter._id,
                    date: dateString, // YYYY-MM-DD format
                    reading: currentReading,
                    status: meter.status || 'opened',
                    time: timeString // HH:MM format
                });

                // Calculate yearMonth value for monthly history (YYYY-MM format)
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth() + 1;
                const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;

                // Save to MonthlyWaterMeterHistory
                const existingMonthlyHistory = await MonthlyWaterMeterHistoryModel.findOne({
                    meterId: meter._id,
                    yearMonth: yearMonth
                });

                if (existingMonthlyHistory) {
                    // Update existing monthly history - keep the same initialReading, update finalReading and consumption
                    existingMonthlyHistory.finalReading = currentReading;
                    existingMonthlyHistory.consumption = currentReading - existingMonthlyHistory.initialReading;
                    await existingMonthlyHistory.save();
                } else {
                    // Create new monthly history
                    await MonthlyWaterMeterHistoryModel.create({
                        meterId: meter._id,
                        yearMonth: yearMonth, // YYYY-MM format
                        initialReading: previousReading,
                        finalReading: currentReading,
                        consumption: consumption
                    });
                }

            } catch (error) {
                results.errors.push({
                    row: record,
                    error: error.message
                });
            }
        }

        // Clean up the temporary file
        fs.unlinkSync(file.path);

        const totalProcessed = results.success + results.updated;

        // Determine the appropriate response based on results
        if (totalProcessed === 0 && results.errors.length > 0) {
            // If no records were successfully imported but there were errors
            return reply.code(400).send({
                success: false,
                message: `Import failed: All ${results.errors.length} records had errors`,
                results
            });
        } else if (results.errors.length > 0) {
            // If some records were imported but some had errors
            return reply.code(207).send({  // 207 Multi-Status is appropriate for partial success
                success: true,
                message: `Partially imported: ${results.success} new readings, ${results.updated} updated, ${results.errors.length} failed`,
                results
            });
        } else if (totalProcessed === 0) {
            // If no records were processed at all (empty file)
            return reply.code(400).send({
                success: false,
                message: 'No records were processed. The file might be empty or invalid.',
                results
            });
        } else {
            // Complete success
            return reply.code(200).send({
                success: true,
                message: `Successfully processed all readings: ${results.success} new, ${results.updated} updated`,
                results
            });
        }
    } catch (err) {
        // Clean up file if it exists
        if (request.file && request.file.path) {
            try {
                fs.unlinkSync(request.file.path);
            } catch (unlinkErr) {
                // Silent error handling for file cleanup
            }
        }
        return reply.code(500).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = importAnalogMeterReadings;