const payservedb = require('payservedb')
const { getModel } = require('../../../utils/getModel');

const allow_visit = async (request, reply) => {
    try {
        const { visitLogId } = request.params
        const { carRegistration, carMake, carColor, carOccupants, entry, otp } = request.body

        const visitLogModel = await getModel('VisitLog', payservedb.VisitLog.schema, facilityId);
        const visitLog = await visitLogModel.findById(visitLogId);

        if (parseInt(otp) !== parseInt(visitLog.visitationCode)) {
            return reply.code(403).send({ error: 'Invalid OTP' })
        }
        else {
            let query = {
                _id: visitLogId
            }
            let data = {
                vehicle: {
                    registration: carRegistration,
                    make: carMake,
                    color: carColor,
                    occupants: carOccupants,
                },
                entryPoint: entry,
                visitationCode: null,
                status: "Checked In"
            }
            await visitLogModel.updateOne(query, data)
            return reply.code(200).send('Updated successfully')
        }
    }
    catch (err) {
        return reply.code(502).send({ error: err.message })
    }
}
module.exports = allow_visit