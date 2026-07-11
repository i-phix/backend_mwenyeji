const utilityDb = require('../../../../middlewares/utilityDb');

const addAnalogMeter = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        let {
            meterNumber,
            unitId,
            customerId,
            initialReading,
            currentReading,
            customerType,
            status,
            manufacturer,
            protocol,
            size,
            valveType
        } = request.body;

        customerId = customerId ? customerId : null;

        // Get the WaterMeter model from utility database
        const analogMeterModel = await utilityDb.getModel('WaterMeter');

        // Check if meter with this number already exists
        const existingMeter = await analogMeterModel.findOne({ meterNumber, facilityId });
        if (existingMeter) {
            return reply.code(400).send({
                error: 'A meter with this meter number already exists'
            });
        }

        // Check if the combination of customerId and unitId already exists
        // Only perform this check if customerId exists
        if (customerId) {
            const existingCustomerUnit = await analogMeterModel.findOne({
                customerId,
                unitId,
                facilityId
            });
            if (existingCustomerUnit) {
                return reply.code(400).send({
                    error: 'A meter for this customer and unit combination already exists'
                });
            }
        }

        const generateAccountNumber = () => {
            const prefix = '1';
            // Generate a random 4-digit number (0000 to 9999)
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            return prefix + random;
        };

        // Generate a unique account number
        const accountNumber = generateAccountNumber();

        // Make sure we have values for the readings
        const initialReadingValue = initialReading || 0;
        const currentReadingValue = currentReading || initialReadingValue;
        const currentDate = new Date();

        // Format the date as YYYY-MM-DD string
        const dateString = currentDate.toISOString().split('T')[0];

        // Format the time as HH:MM string (not HH:MM:SS)
        const timeString = currentDate.toTimeString().split(' ')[0].substring(0, 5);

        // Create the new analog meter document
        const newMeter = {
            facilityId,
            meterType: 'analog',
            meterNumber,
            accountNumber,
            unitId,
            customerId,
            imageUrl: "",
            manufacturer: manufacturer || 'Generic',
            protocol: protocol || 'Manual',
            size: size || 'Standard',
            valveType: valveType || 'manual',
            initialReading: initialReadingValue,
            currentReading: currentReadingValue,
            previousReading: initialReadingValue,
            status: status || 'opened',
            customerType: customerType || (customerId ? 'postpaid' : null),
            lastReadingDate: currentDate
        };

        // Save the meter to utility database
        const savedMeter = await analogMeterModel.create(newMeter);

        // Save to DailyWaterMeterHistory
        const DailyWaterMeterHistoryModel = await utilityDb.getModel('DailyWaterMeterHistory');

        await DailyWaterMeterHistoryModel.create({
            meterId: savedMeter._id,
            date: currentDate,
            reading: currentReadingValue,
            timeStamps: [currentDate]
        });

        // Save to SingleDayWaterMeterHistory with correct date and time format
        const SingleDayWaterMeterHistoryModel = await utilityDb.getModel('SingleDayWaterMeterHistory');

        await SingleDayWaterMeterHistoryModel.create({
            meterId: savedMeter._id,
            date: dateString, // YYYY-MM-DD format
            reading: currentReadingValue,
            status: status || 'opened',
            time: timeString // HH:MM format
        });

        // Calculate yearMonth value for monthly history (YYYY-MM format)
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;

        // Save to MonthlyWaterMeterHistory
        const MonthlyWaterMeterHistoryModel = await utilityDb.getModel('MonthlyWaterMeterHistory');

        await MonthlyWaterMeterHistoryModel.create({
            meterId: savedMeter._id,
            yearMonth: yearMonth, // YYYY-MM format
            initialReading: initialReadingValue,
            finalReading: currentReadingValue,
            consumption: currentReadingValue - initialReadingValue
        });

        // Return the saved meter with all required data for account creation
        return reply.code(200).send({
            message: 'Analog water meter added successfully',
            data: savedMeter
        });
    } catch (err) {
        console.error('Error adding analog meter:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = addAnalogMeter;