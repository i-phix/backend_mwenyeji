const utilityDb = require('../../../../../middlewares/utilityDb');

const add_meter = async (request, reply) => {
  try {
    const MeterModel = await utilityDb.getModel('WaterMeter');

    const {
      serialNumber,
      manufacturer,
      protocol,
      size,
      initialReading,
      concentratorSerialNumber,

      // Meter classification — primary driver
      meterCategory,          // 'unit' | 'bulk' | 'floor'

      // Unit meter fields
      facilityId,
      unitId,

      // Bulk meter fields
      bulkMeterDescription,

      // Floor meter fields
      floorDescription,
    } = request.body;

    // ── Basic required field checks ──────────────────────────────────────────
    if (!serialNumber?.trim()) {
      throw new Error('Serial number is required');
    }
    if (!manufacturer) throw new Error('Manufacturer is required');
    if (!protocol)     throw new Error('Protocol is required');
    if (!size)         throw new Error('Size is required');

    const validCategories = ['unit', 'bulk', 'floor'];
    if (!meterCategory || !validCategories.includes(meterCategory)) {
      throw new Error(`meterCategory must be one of: ${validCategories.join(', ')}`);
    }

    // ── Category-specific validation ─────────────────────────────────────────
    if (meterCategory === 'unit') {
      if (!unitId) {
        throw new Error('unitId is required for unit meters');
      }
    }

    if (meterCategory === 'bulk') {
      if (!bulkMeterDescription) {
        throw new Error('bulkMeterDescription is required for bulk meters');
      }
    }

    if (meterCategory === 'floor') {
      if (!floorDescription?.trim()) {
        throw new Error('floorDescription is required for floor meters');
      }
    }

    // ── Duplicate check ───────────────────────────────────────────────────────
    const meterExists = await MeterModel.findOne({ meterNumber: serialNumber.trim() });
    if (meterExists) {
      throw new Error('Meter with this serial number already exists');
    }

    // ── Account number generator ──────────────────────────────────────────────
    const generateAccountNumber = () => {
      const randomNumber = Math.floor(Math.random() * 10000);
      return '1' + randomNumber.toString().padStart(4, '0');
    };

    // ── Derive status & isInstalled from category ────────────────────────────
    //   unit  → assigned to a unit, so opened & installed
    //   bulk  → standalone supply meter, so opened & installed
    //   floor → sub-distribution meter, so opened & installed
    //   (all three are considered "in service" at creation)
    const isInstalled = true;
    const status      = 'opened';

    // ── Build the document ────────────────────────────────────────────────────
    const meterData = {
      meterType:     'smart',
      meterNumber:   serialNumber.trim(),
      serialNumber:  serialNumber.trim(),
      manufacturer,
      protocol,
      size,
      status,
      initialReading:  initialReading ?? 0,
      currentReading:  initialReading ?? 0,
      accountNumber:   generateAccountNumber(),
      isInstalled,
      valveType:       'automatic',
      accountBalance:  0,
      negativeBalance: 0,
      lastReadingDate: new Date(),
      meterCategory,

      // Keep legacy boolean in sync
      bulkMeter: meterCategory === 'bulk',

      // Optional shared field
      concentratorSerialNumber: concentratorSerialNumber?.trim() || undefined,
    };

    // ── Category-specific fields ──────────────────────────────────────────────
    if (meterCategory === 'unit') {
      meterData.unitId     = unitId;
      meterData.facilityId = facilityId || undefined;
    }

    if (meterCategory === 'bulk') {
      meterData.bulkMeterDescription = bulkMeterDescription;
      // Bulk meters are not tied to a unit or floor
    }

    if (meterCategory === 'floor') {
      meterData.floorDescription = floorDescription.trim();
      meterData.facilityId       = facilityId || undefined;
      // Floor meters are not tied to a specific unit
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    const newMeter = new MeterModel(meterData);
    await newMeter.save();

    return reply.code(200).send({ message: 'Meter added successfully' });

  } catch (err) {
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = add_meter;