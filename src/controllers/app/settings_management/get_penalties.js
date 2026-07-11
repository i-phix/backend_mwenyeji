const payservedb = require('payservedb');

const get_penalties = async (request,reply) => {
    try {
        const { facilityId } = request.params;
    
        if (!facilityId) {
          return reply.code(400).send({ error: 'Facility ID is required' });
        }
    
        const facility = await payservedb.Facility.findById(facilityId);
        
        if (!facility) {
          return reply.code(404).send({ error: 'Facility not found' });
        }
        
        const penalties = await payservedb.Penalty.find({ facilityId: facilityId })
    
        return reply.code(200).send(penalties);
        
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = get_penalties