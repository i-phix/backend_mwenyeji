const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const add_unit = async (request, reply) => {
    try {

        const unitModel = await getModel('Unit', payservedb.Unit.schema, request.params.facilityId)
        const { unitName,
            division,
            floorUnit,
            unitType,
            lettableFloorArea,
            lrNumber,
            grossArea,
            netLettableArea } = request.body

        const unitExist = await unitModel.findOne({  name: unitName, division: division, floorUnitNo: floorUnit })
      
        if (unitExist) {
            throw new Error('Unit already exists')
        }
        else {
            const data = new unitModel({
                name: unitName,
                division: division,
                unitType: unitType,
                floorUnitNo: floorUnit,
                lettableFloorArea: lettableFloorArea,
                landRateNumber: lrNumber,
                grossArea: grossArea,
                netLettableArea: netLettableArea,
                status: "Active",
                facilityId: request.params.facilityId
            })

            const response = await data.save();
            return reply.code(200).send('Unit added successfully');


        }
    }
    catch (err) {
        console.log(err.message)
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = add_unit