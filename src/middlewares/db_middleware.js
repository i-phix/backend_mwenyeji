const payservedb = require('payservedb')
const db_middleware =  (request, reply,done) => {

  const { facilityId } = request.params;
  async function getDBName(){
    const facility = await payservedb.Facility.findById(facilityId)
    return facility
  }
  const facility = getDBName()
  if (!facility) {
    return reply.status(402).send({ error: "Facility not found" })
  }
  else {
    const dbName = facility.dbName;
    request.dbName = dbName
  }
};

module.exports = db_middleware;
