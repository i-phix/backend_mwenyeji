const payservedb = require('payservedb');
const { getModel } = require("../../../../utils/getModel");

const get_visit_logs = async (request, reply) => {
    try {
        const { facilityId, customerId, userType } = request.params;
        let visitorLog
        const visitLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);
        if (userType === 'family') {
            visitorLog = await visitLogModel.find({ userId: customerId }).sort({ _id: -1 });
        }
        else if (userType === 'admin') {
            visitorLog = await visitLogModel.find({ residentId: customerId }).sort({ _id: -1 });
        }
        return reply.code(200).send({ success: true, data: visitorLog });
    } catch (error) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}
module.exports = get_visit_logs