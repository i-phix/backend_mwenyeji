const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_waiting_list = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const waitListModel = await getModel('WaitList', payservedb.WaitList.schema, facilityId);

        const waitList = await waitListModel.find({ facilityId: facilityId }).sort({ _id: -1 });

        return reply.code(200).send({ success: true, data: waitList });
    } catch (error) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}

module.exports = get_waiting_list;
