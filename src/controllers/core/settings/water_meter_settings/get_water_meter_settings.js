const payservedb = require('payservedb')
const get_water_meter_settings = async (request, reply) => {
    try {

        const WaterMeterSetting = await payservedb.WaterMeterSettings.findOne({});
        reply.code(200).send(WaterMeterSetting)
    }
    catch (err) {
        reply.code(502).send(err.message)
    }
}
module.exports = get_water_meter_settings