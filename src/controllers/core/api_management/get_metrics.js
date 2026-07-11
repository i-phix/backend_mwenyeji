const payservedb = require('payservedb')
const logger = require('../../../../config/winston');

const get_metrics = async (request,reply)=>{
 try{
    const results = await payservedb.ApiLog.find({}, { method: 1, url: 1, duration: 1, _id: 0 })
    .sort({ time: 1 })
    .limit(30)
    .lean();
    const groupedData = results.reduce((acc, { method, url, duration }) => {
      if (!acc[method]) {
        acc[method] = { labels: [], data: [] };
      }
      acc[method].labels.push(url);
      acc[method].data.push(duration);
      return acc;
    }, {});
    logger.info('Retrieved api metrics: ' + new Date())
    return reply.code(200).send(groupedData)

  }
  catch (err) {
    logger.error(err.message)
    console.log(err)
    return reply.code(502).send({ error: err.message })
  }
}
module.exports = get_metrics