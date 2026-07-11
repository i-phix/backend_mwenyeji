const payservedb = require('payservedb')
const { getModel } = require('../../../utils/getModel');

const allow_visitor = async (request, reply) => {
    try {
        const { facilityId, visitLogId } = request.params
        const { carRegistration, carMake, carColor, carOccupants, entry, idNumber, visitorType } = request.body

        const visitLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);
        const visitorModel = await getModel('Visitor', payservedb.Visitor.schema, facilityId);
        
        const visitorLog = await visitLogModel.findById(visitLogId)

        let query = {
            _id: visitLogId
        }
        let data = {
            vehicle: {
                registration: carRegistration,
                make: carMake,
                color: carColor,
                occupants: carOccupants,
            },
            entryPoint: entry,
            visitationCode: null,
            status: "Checked In"
        }
        let query2 = {
            _id: visitorLog.visitorId
        }
        let data2 = {
            idNumber: idNumber,
            type: visitorType,
            status: "Checked In"
        }
        await visitLogModel.updateOne(query, data)
        await visitorModel.updateOne(query2, data2)
        return reply.code(200).send({success: true, message: 'Entry Granted'})
    }
    catch (err) {
        return reply.code(502).send({ error: err.message })
    }
}
module.exports = allow_visitor