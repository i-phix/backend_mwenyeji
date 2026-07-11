// const payservedb = require('payservedb');

// const get_visit_log = async (request, reply) => {
//     try {
//         const { facilityId } = request.params;
//         const visitorLog = await payservedb.VisitLog.find({ facilityId: facilityId }).sort({ _id: -1 });
//         return reply.code(200).send({ success: true, data: visitorLog });
//     } catch (error) {
//         return reply.code(500).send({ success: false, error: error.message });
//     }
// }

// module.exports = get_visit_log;


const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_visit_log = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { page = 0, size = 10 } = request.query;
        const skip = parseInt(page) * parseInt(size);
        const limit = parseInt(size);

        const statusFilter = {
            facilityId: facilityId,
            status: { $in: ['Visit Confirmation', 'Denied', 'Checked In'] }
        };

        const visitorLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);

        const [visitorLog, total] = await Promise.all([
            visitorLogModel.find(statusFilter)
                .sort({ _id: -1 })
                .skip(skip)
                .limit(limit),
            visitorLogModel.countDocuments(statusFilter)
        ]);

        return reply.code(200).send({ success: true, data: visitorLog, total });
    } catch (error) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}

module.exports = get_visit_log;


