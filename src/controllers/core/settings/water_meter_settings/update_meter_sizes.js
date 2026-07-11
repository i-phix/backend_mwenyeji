const payservedb = require('payservedb')
const update_meter_sizes = async (request, reply) => {
    try {
        const { size } = request.body;
        const WaterMeterSetting = await payservedb.WaterMeterSettings.findOne({});

        if (WaterMeterSetting) {
            let query = {
                _id: WaterMeterSetting._id
            }
            let meterSizes = WaterMeterSetting.meterSizes === undefined ? [] : WaterMeterSetting.meterSizes;
            meterSizes.push(size)
            let data = {
                meterSizes
            }
            await WaterMeterSetting.updateOne(query, data)
            reply.code(200).send('Updated successfully')
        }
    }
    catch (err) {
        reply.code(502).send(err.message)
    }
}
module.exports = update_meter_sizes