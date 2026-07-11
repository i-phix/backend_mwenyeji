// const utilityDb = require('../../../../middlewares/utilityDb');
// const path = require('path');

// const updateMeterReading = async (request, reply) => {
//     try {
//         const { meterId } = request.params;

//         const { currentReading, readBy, unitName } = request.body;

//         console.log("request.body", request.body); // ✅ should contain text fields
//         console.log("request.file", request.file);


//         // Create full URL for the image
//         const image = request.file ?
//             `${request.protocol}://${request.headers.host}/uploads/${path.basename(request.file.path)}` :
//             null;



//         if (!meterId || currentReading === undefined) {
//             return reply.code(400).send({
//                 error: 'meterId and currentReading are required'
//             });
//         }

//         const numericReading = parseFloat(currentReading);

//         if (isNaN(numericReading)) {
//             return reply.code(400).send({
//                 error: 'currentReading must be a valid number'
//             });
//         }

//         // Get WaterMeter model from utility database
//         const MeterModel = await utilityDb.getModel('WaterMeter');

//         // Find the meter
//         const meter = await MeterModel.findById(meterId);
//         if (!meter) {
//             return reply.code(404).send({
//                 error: 'Meter not found'
//             });
//         }

//         // Validate reading
//         if (currentReading < meter.currentReading) {
//             return reply.code(400).send({
//                 error: 'New reading cannot be less than previous reading'
//             });
//         }

//         const currentDate = new Date();
//         const previousReading = meter.currentReading;
//         const consumption = currentReading - previousReading;
//         const timeString = currentDate.toTimeString().split(' ')[0];

//         // Update meter
//         meter.previousReading = previousReading;
//         meter.currentReading = currentReading;
//         meter.imageUrl = image;
//         meter.lastReadingDate = currentDate;

//         await meter.save();

//         // Create/update DailyWaterMeterHistory
//         const DailyWaterMeterHistoryModel = await utilityDb.getModel('DailyWaterMeterHistory');

//         // Check if we already have an entry for this meter and date
//         const today = new Date(currentDate);
//         today.setHours(0, 0, 0, 0);

//         const tomorrow = new Date(today);
//         tomorrow.setDate(tomorrow.getDate() + 1);

//         const existingDailyReading = await DailyWaterMeterHistoryModel.findOne({
//             meterId: meter._id,
//             date: {
//                 $gte: today,
//                 $lt: tomorrow
//             }
//         });

//         if (existingDailyReading) {
//             // Update existing record
//             existingDailyReading.reading = currentReading;
//             existingDailyReading.timeStamps.push(currentDate);
//             await existingDailyReading.save();
//         } else {
//             // Create new record
//             await DailyWaterMeterHistoryModel.create({
//                 meterId: meter._id,
//                 date: today,
//                 reading: currentReading,
//                 timeStamps: [currentDate]
//             });
//         }

//         // Create SingleDayWaterMeterHistory entry
//         const SingleDayWaterMeterHistoryModel = await utilityDb.getModel('SingleDayWaterMeterHistory');

//         await SingleDayWaterMeterHistoryModel.create({
//             meterId: meter._id,
//             date: today,
//             reading: currentReading,
//             time: timeString
//         });

//         // Handle MonthlyWaterMeterHistory
//         const MonthlyWaterMeterHistoryModel = await utilityDb.getModel('MonthlyWaterMeterHistory');

//         // Calculate yearMonth value for monthly history (YYYYMM format)
//         const year = currentDate.getFullYear();
//         const month = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
//         const yearMonth = year * 100 + month; // Creates YYYYMM format

//         // Check if we already have a monthly record for this meter and month
//         const existingMonthlyReading = await MonthlyWaterMeterHistoryModel.findOne({
//             meterId: meter._id,
//             yearMonth: yearMonth
//         });

//         if (existingMonthlyReading) {
//             // Update existing monthly record
//             // Only update if current reading is greater than what we have
//             if (currentReading > existingMonthlyReading.currentReading) {
//                 existingMonthlyReading.previousReading = existingMonthlyReading.currentReading;
//                 existingMonthlyReading.currentReading = currentReading;
//                 existingMonthlyReading.consumption = existingMonthlyReading.consumption +
//                     (currentReading - existingMonthlyReading.currentReading);
//                 await existingMonthlyReading.save();
//             }
//         } else {
//             // Create new monthly record - use the previous reading from the meter
//             await MonthlyWaterMeterHistoryModel.create({
//                 meterId: meter._id,
//                 yearMonth: yearMonth,
//                 initialReading: previousReading,
//                 finalReading: currentReading,
//                 consumption: consumption
//             });
//         }

//         return reply.code(200).send({
//             message: 'Meter reading updated successfully',
//             data: meter
//         });

//     } catch (err) {
//         console.error('Error updating meter reading:', err);
//         return reply.code(400).send({ error: err.message });
//     }
// };

// module.exports = updateMeterReading;


const utilityDb = require('../../../../middlewares/utilityDb');
const path = require('path');

const updateMeterReading = async (request, reply) => {
    try {
        const { meterId } = request.params;
        const { currentReading, readBy, unitName } = request.body;

        console.log("request.body", request.body);
        console.log("request.file", request.file);

        const image = request.file
            ? `${request.protocol}://${request.headers.host}/uploads/${path.basename(request.file.path)}`
            : null;

        if (!meterId || currentReading === undefined) {
            return reply.code(400).send({
                error: 'meterId and currentReading are required'
            });
        }

        const numericReading = parseFloat(currentReading);

        if (isNaN(numericReading)) {
            return reply.code(400).send({
                error: 'currentReading must be a valid number'
            });
        }

        const MeterModel = await utilityDb.getModel('WaterMeter');
        const meter = await MeterModel.findById(meterId);
        if (!meter) {
            return reply.code(404).send({
                error: 'Meter not found'
            });
        }

        if (numericReading < meter.currentReading) {
            return reply.code(400).send({
                error: 'New reading cannot be less than previous reading'
            });
        }

        const currentDate = new Date();
        const previousReading = meter.currentReading;
        const consumption = numericReading - previousReading;
        
        // Format the date as YYYY-MM-DD string
        const dateString = currentDate.toISOString().split('T')[0];
        
        // Format the time as HH:MM string (not HH:MM:SS)
        const timeString = currentDate.toTimeString().split(' ')[0].substring(0, 5);

        meter.previousReading = previousReading;
        meter.currentReading = numericReading;
        meter.imageUrl = image;
        meter.lastReadingDate = currentDate;

        await meter.save();

        const DailyWaterMeterHistoryModel = await utilityDb.getModel('DailyWaterMeterHistory');
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const existingDailyReading = await DailyWaterMeterHistoryModel.findOne({
            meterId: meter._id,
            date: {
                $gte: today,
                $lt: tomorrow
            }
        });

        if (existingDailyReading) {
            existingDailyReading.reading = numericReading;
            await existingDailyReading.save();
        } else {
            await DailyWaterMeterHistoryModel.create({
                meterId: meter._id,
                date: today,
                reading: numericReading
            });
        }

        const SingleDayWaterMeterHistoryModel = await utilityDb.getModel('SingleDayWaterMeterHistory');

        await SingleDayWaterMeterHistoryModel.create({
            meterId: meter._id,
            date: dateString, // YYYY-MM-DD format
            reading: numericReading,
            status: meter.status || 'opened',
            time: timeString // HH:MM format
        });

        const MonthlyWaterMeterHistoryModel = await utilityDb.getModel('MonthlyWaterMeterHistory');

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;

        const existingMonthlyReading = await MonthlyWaterMeterHistoryModel.findOne({
            meterId: meter._id,
            yearMonth: yearMonth
        });

        if (existingMonthlyReading) {
            // Update the existing monthly record
            // Keep the same initialReading, update finalReading and consumption
            existingMonthlyReading.finalReading = numericReading;
            existingMonthlyReading.consumption = numericReading - existingMonthlyReading.initialReading;
            await existingMonthlyReading.save();
        } else {
            // Create new monthly record
            await MonthlyWaterMeterHistoryModel.create({
                meterId: meter._id,
                yearMonth: yearMonth, // YYYY-MM format
                initialReading: previousReading,
                finalReading: numericReading,
                consumption: consumption
            });
        }

        // Handle AnalogBilling - only for analog meters
        if (meter.meterType === 'analog') {
            const AnalogBillingModel = await utilityDb.getModel('AnalogBilling');

            // Format yearMonth for AnalogBilling (YYYY-MM format) - now same as MonthlyWaterMeterHistory
            const yearMonthString = `${year}-${month.toString().padStart(2, '0')}`;

            // Check if we already have an analog billing record for this meter and month
            const existingAnalogBilling = await AnalogBillingModel.findOne({
                meterNumber: meter.meterNumber,
                yearMonth: yearMonthString
            });

            if (existingAnalogBilling) {
                // Update existing analog billing record
                const newUsage = numericReading - existingAnalogBilling.previousReading;

                existingAnalogBilling.currentReading = numericReading;
                existingAnalogBilling.totalUsage = newUsage;
                await existingAnalogBilling.save();
            } else {
                // Create new analog billing record
                await AnalogBillingModel.create({
                    facilityId: meter.facilityId,
                    meterNumber: meter.meterNumber,
                    accountNumber: meter.accountNumber,
                    currentReading: numericReading,
                    previousReading: previousReading,
                    yearMonth: yearMonthString,
                    totalUsage: consumption,
                    unitName: unitName,
                    customerId: meter.customerId,
                    billingType: 'postpaid',
                    status: 'pending'
                });
            }
        }

        return reply.code(200).send({
            message: 'Meter reading updated successfully',
            data: {
                meter: meter,
                consumption: consumption,
                previousReading: previousReading,
                currentReading: numericReading
            }
        });

    } catch (err) {
        console.error('Error updating meter reading:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = updateMeterReading;