const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const update_guard_info = async (request, reply) => {
    try {
        const { facilityId, guardId } = request.params;
        const {
            firstName,
            lastName,
            phoneNumber,
            email,
            status,
            startTime,
            endTime,
        } = request.body;

        const query = { _id: guardId };

        const fullName = `${firstName} ${lastName}`;

        const data = {
            firstName: firstName,
            lastName: lastName,
            status: status,
            phoneNumber: phoneNumber,
            email: email,
            startTime: startTime,
            endTime: endTime,
        };

        const guardModel = await getModel('Guard', payservedb.Guard.schema, facilityId);

        await guardModel.updateOne(query, data);

        await payservedb.User.updateOne(
            { guardId },
            {
                fullName,
                phoneNumber,
                email,
            }
        );

        return reply.code(200).send({success: true, message: 'Guard Info updated successfully'});

    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_guard_info;
