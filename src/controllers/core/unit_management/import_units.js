const payservedb = require('payservedb')
const { getModel } = require('../../../utils/getModel');
const import_units = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { units } = request.body

        units.map((unit) => {
            add_unit(unit, facilityId)
        })
        return reply.code(200).send('Units will be added shortly.');

    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}

const add_unit = async (unitData, facilityId) => {
    try {
        const { unit,
            division,
            floorUnitNo,
            unitType,
            landRateNumber,
            lettableFloorArea,
            netLettableArea,
            grossArea

        } = unitData
        const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId)

        const unitExist = await UnitModel.findOne({ name: unit, division: division })
        if (unitExist) {
            throw new Error('Unit already exists')
        }
        else {

            const data = new UnitModel({
                name: unit,
                division: division,
                unitType: unitType,
                floorUnitNo: floorUnitNo,
                lettableFloorArea: lettableFloorArea,
                landRateNumber: landRateNumber,
                grossArea: grossArea,
                netLettableArea: netLettableArea,
                facilityId: facilityId,
                status: "Active"
            })
            const response = await data.save();
            console.log(response)

        }
    }
    catch (err) {
        console.log(err)
    }


}
module.exports = import_units