const XLSX = require('xlsx');
const utilityDb = require('../../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const fs = require('fs');
const path = require('path');

// Helper function to safely convert and trim values
const safeTrim = (value) => {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim();
};

// Helper function to safely convert to lowercase
const safeLowerCase = (value) => {
  const trimmed = safeTrim(value);
  return trimmed ? trimmed.toLowerCase() : null;
};

// Helper function to safely convert to number
const safeNumber = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

// Helper function to safely convert to boolean
const safeBoolean = (value) => {
  if (value === null || value === undefined) return false;
  const str = String(value).toLowerCase().trim();
  return str === 'true' || str === '1' || str === 'yes';
};

// Helper function to safely convert to date
const safeDate = (value) => {
  if (!value) return new Date();
  const date = new Date(value);
  return isNaN(date.getTime()) ? new Date() : date;
};

// Helper function to generate account number
const generateAccountNumber = () => {
  const randomNumber = Math.floor(Math.random() * 10000);
  return '1' + randomNumber.toString().padStart(4, '0');
};

const import_meters = async (request, reply) => {
  try {
    const file = request.file;
    if (!file) {
      return reply.code(400).send({ error: "No file uploaded" });
    }

    const filePath = file.path;
    const extension = path.extname(file.originalname).toLowerCase();
    const valid = ['.csv', '.xlsx', '.xls'];

    if (!valid.includes(extension)) {
      fs.unlinkSync(filePath);
      return reply.code(400).send({ error: "Invalid file type" });
    }

    const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (!rows.length) {
      fs.unlinkSync(filePath);
      return reply.code(400).send({ error: "File is empty" });
    }

    const MeterModel = await utilityDb.getModel("WaterMeter");

    const results = {
      total: rows.length,
      successful: 0,
      failed: 0,
      errors: [],
      generatedAccountNumbers: [] // Track generated account numbers
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        // Validate required fields (account_number is now optional)
        const meterNumber = safeTrim(row.meter_number);
        const facilityName = safeTrim(row.facility_name);
        const manufacturer = safeTrim(row.manufacturer);
        const protocol = safeTrim(row.protocol);
        const size = safeTrim(row.size);

        if (!meterNumber || !facilityName || !manufacturer || !protocol || !size) {
          results.failed++;
          results.errors.push({ 
            row: rowNum, 
            error: "Missing required fields (meter_number, facility_name, manufacturer, protocol, size)" 
          });
          continue;
        }

        // Find facility
        const facility = await payservedb.Facility.findOne({
          name: { $regex: new RegExp(`^${facilityName}$`, 'i') }
        });

        if (!facility) {
          results.failed++;
          results.errors.push({ row: rowNum, error: `Facility not found: ${facilityName}` });
          continue;
        }

        // Find unit if provided
        let unitId = null;
        const unitName = safeTrim(row.unit_name);
        if (unitName) {
          const UnitModel = await getModel('Unit', payservedb.Unit.schema, facility._id);
          const unit = await UnitModel.findOne({
            name: { $regex: new RegExp(`^${unitName}$`, 'i') },
            facilityId: facility._id
          });
          if (unit) {
            unitId = unit._id;
          } else {
            results.failed++;
            results.errors.push({ row: rowNum, error: `Unit not found: ${unitName}` });
            continue;
          }
        }

        // Check if meter already exists
        const exists = await MeterModel.findOne({
          meterNumber: meterNumber
        });

        if (exists) {
          results.failed++;
          results.errors.push({ row: rowNum, error: `Meter already exists: ${meterNumber}` });
          continue;
        }

        // Process meter type
        const meterType = safeLowerCase(row.meter_type) || 'smart';
        if (!['analog', 'smart'].includes(meterType)) {
          results.failed++;
          results.errors.push({ row: rowNum, error: `Invalid meter_type: ${row.meter_type}. Must be 'analog' or 'smart'` });
          continue;
        }

        // Process status
        const status = safeLowerCase(row.status) || 'opened';
        if (!['opened', 'closed', 'maintenance', 'faulty'].includes(status)) {
          results.failed++;
          results.errors.push({ row: rowNum, error: `Invalid status: ${row.status}. Must be 'opened', 'closed', 'maintenance', or 'faulty'` });
          continue;
        }

        // Process installation status
        const installationStatus = safeLowerCase(row.installation_status) || 'installed';
        if (!['installed', 'not installed'].includes(installationStatus)) {
          results.failed++;
          results.errors.push({ row: rowNum, error: `Invalid installation_status: ${row.installation_status}. Must be 'installed' or 'not installed'` });
          continue;
        }

        // Process customer type
        const customerType = safeLowerCase(row.customer_type);
        if (customerType && !['postpaid', 'prepaid'].includes(customerType)) {
          results.failed++;
          results.errors.push({ row: rowNum, error: `Invalid customer_type: ${row.customer_type}. Must be 'postpaid' or 'prepaid'` });
          continue;
        }

        // Process valve type
        const valveType = safeLowerCase(row.valve_type) || 'automatic';
        if (!['automatic', 'manual'].includes(valveType)) {
          results.failed++;
          results.errors.push({ row: rowNum, error: `Invalid valve_type: ${row.valve_type}. Must be 'automatic' or 'manual'` });
          continue;
        }

        // Process bulk meter
        const bulkMeter = safeBoolean(row.bulk_meter);
        const bulkMeterDescription = safeTrim(row.bulk_meter_description);
        
        if (bulkMeterDescription) {
          const validDescriptions = [
            'City Council Bulk', 
            'Borehole Bulk', 
            'Bulk Inlet', 
            'Bulk Outlet',
            'Bulk Borehole Outlet', 
            'Common Area'
          ];
          if (!validDescriptions.includes(bulkMeterDescription)) {
            results.failed++;
            results.errors.push({ 
              row: rowNum, 
              error: `Invalid bulk_meter_description: ${bulkMeterDescription}. Must be one of: ${validDescriptions.join(', ')}` 
            });
            continue;
          }
        }

        // Validate bulk meter requirements
        if (bulkMeter && !bulkMeterDescription) {
          results.failed++;
          results.errors.push({ 
            row: rowNum, 
            error: 'Bulk meter description is required when bulk_meter is true' 
          });
          continue;
        }

        // Process readings and dates
        const initialReading = safeNumber(row.initial_reading, 0);
        const previousReading = safeNumber(row.previous_reading, 0);
        const currentReading = safeNumber(row.current_reading, 0);
        const lastReadingDate = safeDate(row.last_reading_date);

        // Validate readings are non-negative
        if (initialReading < 0 || previousReading < 0 || currentReading < 0) {
          results.failed++;
          results.errors.push({ row: rowNum, error: "Reading values cannot be negative" });
          continue;
        }

        // Get serial number (default to meter number if not provided)
        const serialNumber = safeTrim(row.serial_number) || meterNumber;

        // Check if serial number already exists
        const serialExists = await MeterModel.findOne({
          serialNumber: serialNumber
        });

        if (serialExists) {
          results.failed++;
          results.errors.push({ row: rowNum, error: `Serial number already exists: ${serialNumber}` });
          continue;
        }

        // Handle account number - generate if not provided
        let accountNumber = safeTrim(row.account_number);
        let isGeneratedAccount = false;
        
        if (!accountNumber) {
          // Generate account number
          let isUnique = false;
          let attempts = 0;
          const maxAttempts = 100;
          
          while (!isUnique && attempts < maxAttempts) {
            accountNumber = generateAccountNumber();
            const accountExists = await MeterModel.findOne({ accountNumber });
            if (!accountExists) {
              isUnique = true;
              isGeneratedAccount = true;
            }
            attempts++;
          }
          
          if (!isUnique) {
            results.failed++;
            results.errors.push({ 
              row: rowNum, 
              error: 'Failed to generate unique account number after multiple attempts' 
            });
            continue;
          }
        } else {
          // Check if provided account number already exists
          const accountExists = await MeterModel.findOne({
            accountNumber: accountNumber
          });

          if (accountExists) {
            results.failed++;
            results.errors.push({ row: rowNum, error: `Account number already exists: ${accountNumber}` });
            continue;
          }
        }

        // Build meter data object
        const meterData = {
          meterType,
          meterNumber,
          serialNumber,
          accountNumber,
          facilityId: facility._id,
          unitId: bulkMeter ? undefined : unitId, // No unit for bulk meters
          manufacturer,
          protocol,
          size,
          initialReading,
          previousReading,
          currentReading,
          lastReadingDate,
          status,
          installationStatus,
          isInstalled: installationStatus === 'installed',
          customerType,
          concentratorSerialNumber: safeTrim(row.concentrator_serial_number),
          valveType,
          accountBalance: safeNumber(row.account_balance, 0),
          negativeBalance: safeNumber(row.negative_balance, 0),
          bulkMeter,
          bulkMeterDescription: bulkMeter ? bulkMeterDescription : null,
          enforcement: safeBoolean(row.enforcement)
        };

        // Create and save meter
        const meter = new MeterModel(meterData);
        await meter.save();

        results.successful++;
        
        // Track generated account numbers
        if (isGeneratedAccount) {
          results.generatedAccountNumbers.push({
            row: rowNum,
            meterNumber,
            accountNumber
          });
        }

      } catch (err) {
        results.failed++;
        results.errors.push({ row: rowNum, error: err.message });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    return reply.code(200).send({
      success: true,
      message: "Import completed",
      results
    });

  } catch (err) {
    // Clean up file if it exists
    if (request.file && request.file.path) {
      try {
        fs.unlinkSync(request.file.path);
      } catch (unlinkErr) {
        // Ignore unlink errors
      }
    }
    
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = import_meters;