const payservedb = require('payservedb')
const update_manufacturers = async (request, reply) => {
    try {
        const { manufacturer } = request.body;
        const WaterMeterSetting = await payservedb.WaterMeterSettings.findOne({});

        if (WaterMeterSetting) {
            let query = {
                _id: WaterMeterSetting._id
            }
            let manufacturers = WaterMeterSetting.manufacturers === undefined ? [] : WaterMeterSetting.manufacturers;
            let filter = manufacturers.filter((x)=>{
                return x === manufacturer
            })
            if(filter.length > 0){
                throw new Error('Name already exists')

            }
            manufacturers.push(manufacturer)
            let data = {
                manufacturers
            }
            await WaterMeterSetting.updateOne(query, data)
            reply.code(200).send('Updated successfully')
        }
    }
    catch (err) {
        reply.code(502).send(err.message)
    }
}
module.exports = update_manufacturers