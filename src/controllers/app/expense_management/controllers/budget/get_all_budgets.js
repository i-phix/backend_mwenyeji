const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getAllBudgets = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { startDate, endDate } = request.query;

        const budgetModel = await getModel('Budget', payservedb.Budget.schema, facilityId);

        const query = { facilityId };

        if (startDate && endDate) {
            query['period.startDate'] = { $gte: new Date(startDate) };
            query['period.endDate'] = { $lte: new Date(endDate) };
        }

        // Fetch the budgets using the query
        const budgets = await budgetModel.find(query).lean();

        return reply.code(200).send({
            message: 'Budgets retrieved successfully',
            budgets
        });
    } catch (err) {
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = getAllBudgets;
