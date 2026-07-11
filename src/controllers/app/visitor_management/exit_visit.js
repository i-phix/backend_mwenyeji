const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const exit_visit_log = async (request, reply) => {
    try {
        const { visitLogId, facilityId } = request.params;
        const { exit } = request.body

        const visitLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);
        const visitLog = await visitLogModel.findById(visitLogId)
        const visitorModel = await getModel('Visitor', payservedb.Visitor.schema, facilityId);

        let query = {
            _id: visitLogId
        }
        let data = {}

        let query2 = {
            _id: visitLog.visitorId
        }

        let data2 = {
            status: 'Checked Out',
        }

        data.status = 'Checked Out';
        data.endTime = new Date()
        data.exitPoint = exit
        await visitLogModel.updateOne(query, data)
        await visitorModel.updateOne(query2, data2)
        return reply.code(200).send('Updated successfully')
    }
    catch (err) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}
module.exports = exit_visit_log