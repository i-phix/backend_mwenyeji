const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const getDepartments = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                message: 'Facility ID is required'
            });
        }

        const Department = await getModel('FacilityDepartment', payservedb.FacilityDepartment.schema, facilityId);
        const departments = await Department.find({ facilityId }).sort({ createdAt: -1 });

        return reply.code(200).send({
            success: true,
            data: departments
        });
    } catch (err) {
        console.error('Error fetching departments:', err);
        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = getDepartments;