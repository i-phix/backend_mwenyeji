const payservedb = require('payservedb');
const logger = require('../../../../../../config/winston');

const delete_concentrator = async (request, reply) => {
    try {
        const { concentratorId } = request.params;
        const deletedConcentrator = await payservedb.Concentrator.findByIdAndDelete(concentratorId);
        
        if (!deletedConcentrator) {
            return reply.code(404).send({ error: 'Concentrator not found' });
        }
       
        return reply.code(200).send({ message: 'Concentrator deleted successfully' });
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_concentrator;