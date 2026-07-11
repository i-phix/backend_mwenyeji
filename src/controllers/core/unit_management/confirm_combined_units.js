const payservedb = require('payservedb')
const { getModel } = require('../../../utils/getModel');
const confirm_combined_units = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;
        const CombinedUnitModel = await getModel('CombinedUnit', payservedb.CombinedUnit.schema, facilityId)
        const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId)

        const combinedUnit = await CombinedUnitModel.findById(unitId);
        if (combinedUnit) {

            const unitExist = await UnitModel.findOne({ name: combinedUnit.combinedUnitName, division: combinedUnit.combinedDivision, floorUnitNo: combinedUnit.combinedFloorUnit })
            if (unitExist) {
                throw new Error('Unit already exists')
            }
            else {
                let selectedCombinedUnits = combinedUnit.selectedCombinedUnits;
                selectedCombinedUnits.map(async (item) => {
                    let query = {
                        _id: item
                    }
                    let data = {};
                    data.status = 'Archived'
                    await UnitModel.updateOne(query, data)
                })

                let data = new UnitModel({
                    name: combinedUnit.combinedUnitName,
                    unitType: combinedUnit.combinedUnitType,
                    division: combinedUnit.combinedDivision,
                    floorUnitNo: combinedUnit.combinedFloorUnit,
                    lettableFloorArea: combinedUnit.combinedLettableFloorArea,
                    landRateNumber: combinedUnit.combinedLRNumber,
                    grossArea: combinedUnit.combinedGrossArea,
                    netLettableArea: combinedUnit.combinedNetLettableArea,
                    status: "Active"
                })
                const response = await data.save();

                let query = {
                    _id: unitId
                }
                let dat = {};
                dat.status = 'Approved'
                const res = await CombinedUnitModel.updateOne(query, dat)
                return reply.code(200).send('Successfully Combined Units');


            }

        }
    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = confirm_combined_units