const payservedb = require('payservedb')
const update_sms_email_settings = async (request, reply) => {
    try {
        const {
            provider,
            emailFrom,
            emailPort,
            emailHost,
            emailAuthUser,
            emailAuthPass,
            senderId1,
            username,
            apiKey1,
            senderId2,
            apiKey2
        } = request.body
        const query = {
            user: "Payserve"
        }
        const data1 = {
            from: emailFrom,
            port: emailPort,
            host: emailHost,
            auth: {
                user: emailAuthUser,
                pass: emailAuthPass
            }
        }
        const data2 = {
            senderId: senderId1,
            username: username,
            apiKey: apiKey1
        }
        const data3 = {
            senderId: senderId2,
            apiKey: apiKey2
        }
        await payservedb.Email.updateOne(query,data1)
        await payservedb.SMSAfricastalking.updateOne(query,data2)
        await payservedb.SMSMeliora.updateOne(query,data3);
        return reply.code(200).send('Updated successfully')
        


    }
    catch (err) {
        return reply.code(502).send(err.message)
    }
}
module.exports = update_sms_email_settings