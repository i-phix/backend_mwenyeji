const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_guard_times = async (request, reply) => {
    try {
        // const { guardId } = request.params;
        const { userId } = request.user

        const guardModel = await getModel('Guard', payservedb.Guard.schema, facilityId);

        const userExist = await payservedb.User.findById(userId);
        if (userExist) {
            if (userExist.role === 'guard') {
                const guard = await guardModel.findById(userExist.guardId);
                return reply.code(200).send({
                    startTime: guard.startTime,
                    endTime: guard.endTime
                });
            }

        }


    } catch (err) {
        console.log(err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_guard_times;
