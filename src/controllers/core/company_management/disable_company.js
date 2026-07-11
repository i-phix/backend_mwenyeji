const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const disable_company = async (request,reply)=>{
   try{
      const { id }= request.params
      const company = await payservedb.Company.findById(id)
      let query = {
        _id: item
      }
      let data = {
        isEnabled: false
      }
      await payservedb.Company.updateOne(query,data)
      company.facilities.map(async(item)=>{
        let query = {
            _id:item
        }
        let data = {
            isEnabled:false
        }
        await payservedb.Facility.updateOne(query,data)

    })

    return reply.code(200).send('Disabled successfully')
  }
  catch (err) {
    logger.error(err.message)
    console.log(err)
    return reply.code(502).send({ error: err.message })
  }
}
module.exports = disable_company