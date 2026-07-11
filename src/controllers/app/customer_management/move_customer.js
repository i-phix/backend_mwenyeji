const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const move_customer_unit = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { customerId, unitId, newUnitId } = request.body;

    if (!customerId || !unitId || !newUnitId) {
      return reply.code(400).send({ error: 'Missing required fields: customerId, unitId, newUnitId' });
    }

    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
    const leaseModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);

    // Step 1: Clear tenantId and residentId from old unit
    const currentUnit = await unitModel.findOne({ _id: unitId });
    if (!currentUnit) {
      return reply.code(404).send({ error: 'Current unit not found' });
    }

    if (
      String(currentUnit.tenantId) !== customerId &&
      String(currentUnit.residentId) !== customerId
    ) {
      return reply.code(400).send({ error: 'Customer is not assigned to the current unit' });
    }

    const activeLease = await leaseModel.findOne({
      unitNumber: unitId,
      tenant: customerId,
      status: 'Active',
    });

    if (activeLease) {
      activeLease.status = 'Terminated';
      activeLease.updatedAt = new Date();

      activeLease.editHistory.push({
        editedBy: 'Move Customer',
        editedAt: new Date(),
        reason: 'Tenant moved to another unit',
      });

      await activeLease.save();
    }

    // Update moveOutDate for the tenant in occupants[]
    await unitModel.updateOne(
      { _id: unitId },
      {
        $set: {
          'occupants.$[elem].moveOutDate': new Date(),
        },
      },
      {
        arrayFilters: [
          { 'elem.customerId': customerId, 'elem.customerType': 'tenant' },
        ],
      }
    );

    await unitModel.updateOne(
      { _id: unitId },
      {
        $unset: {
          tenantId: '',
          residentId: '',
        },
      }
    );

    // Step 2: Assign tenantId and residentId to the new unit
    const targetUnit = await unitModel.findOne({ _id: newUnitId });
    if (!targetUnit) {
      return reply.code(404).send({ error: 'New unit not found' });
    }

    if (targetUnit.tenantId || targetUnit.residentId) {
      return reply.code(400).send({ error: 'Target unit is already occupied' });
    }

    // Create a fresh occupant record in the new unit
    const newOccupant = {
      customerId,
      customerType: 'tenant',
      moveInDate: new Date(),
      moveOutDate: null,
    };

    await unitModel.updateOne(
      { _id: newUnitId },
      {
        tenantId: customerId,
        residentId: customerId,
        $push: { occupants: newOccupant }, // Add new occupant
      }
    );

    return reply.code(200).send({ success: true, message: 'Tenant moved successfully' });
  } catch (err) {
    console.error(err);
    return reply.code(500).send({ error: 'An error occurred while moving the tenant' });
  }
};

module.exports = move_customer_unit;
