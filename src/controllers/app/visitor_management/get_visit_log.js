const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_visit_log = async (request, reply) => {
    try {
        const { facilityId, visitLogId } = request.params;

        const visitorLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);
        const visitorModel = await getModel('Visitor', payservedb.Visitor.schema, facilityId);

        const visitLog = await visitorLogModel.findById(visitLogId);
        if (visitLog) {
            const visitor = await visitorModel.findById(visitLog.visitorId)
            const resident = await payservedb.Customer.findById(visitLog.residentId)
            const user = await payservedb.User.findById(visitLog.requestedBy)
            return reply.code(200).send({ visitLog, visitor, resident, user })
        }
    }
    catch (err) {
        return reply.code(500).send({ success: false, error: err.message });
    }
}
module.exports = get_visit_log