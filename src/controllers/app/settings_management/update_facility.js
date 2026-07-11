const payservedb = require('payservedb');
const path = require('path');

const UpdateFacilityInfo = async (request, reply) => {
    try{
        const { facilityId } = request.params;
        
        const image = request.file
              ? `${request.protocol}://${request.headers.host}/uploads/${path.basename(request.file.path)}`
              : null;

        const updatedFacility = await payservedb.Facility.findByIdAndUpdate(
            facilityId,
            { logo: image },
            { new: true }
        );
        
        return reply.code(200).send({
            success: true,
            message: "Facility Logo updated successfully",
            data: { logo: updatedFacility.logo } 
        });
        

    }
    catch(err){
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = UpdateFacilityInfo