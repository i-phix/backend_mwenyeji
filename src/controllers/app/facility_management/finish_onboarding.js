const payservedb = require('payservedb');

const finish_onboarding = async (request, reply) => {
    try{
        const { facilityId } = request.params;
        
        const facility = await payservedb.Facility.findById(facilityId);
        
        facility.isOnboarded = true;
        await facility.save();
        return reply.code(200).send({ success: true, message: 'Onboarding completed successfully' });
    }catch(err){
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = finish_onboarding;