const payservedb = require('payservedb');
const logger = require('../../../../../../config/winston');

const get_concentrator = async (request, reply) => {
    try {
        const { concentratorId } = request.params;
        const concentrator = await payservedb.Concentrator.findById(concentratorId);
        
        if (!concentrator) {
            return reply.code(404).send({ error: 'Concentrator not found' });
        }
       
        return reply.code(200).send(concentrator);
    } catch (err) {
       
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_concentrator;