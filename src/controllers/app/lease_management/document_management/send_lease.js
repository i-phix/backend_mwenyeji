const nodemailer = require('nodemailer');
const { getModel } = require('../../../../utils/getModel');
const payservedb = require('payservedb');

const send_lease = async (request, reply) => {
    try {
        const { leaseId, facilityId } = request.body;

        // Validate that both leaseId and facilityId are provided
        if (!leaseId || !facilityId) {
            return reply.code(400).send({ error: 'Lease ID and Facility ID are required.' });
        }

        // Fetch the lease model and the lease record from the facility-specific database
        const leaseModel = await getModel('Lease', payservedb.Lease.schema, facilityId);
        const lease = await leaseModel.findById(leaseId)
            .populate('customerId', 'email firstName') // Fetch customer details
            .populate('templateId'); // Fetch lease template details

        if (!lease) {
            return reply.code(404).send({ error: 'Lease not found.' });
        }

        // Create the email transporter using environment variables for credentials
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER, // Email user from environment variables
                pass: process.env.EMAIL_PASSWORD, // Email password from environment variables
            },
        });

        // Prepare the email content
        const mailOptions = {
            from: process.env.EMAIL_USER, // Sender's email
            to: lease.customerId.email, // Recipient's email (customer)
            subject: `Your Lease Agreement - Lease ID: ${leaseId}`,
            text: `Dear ${lease.customerId.firstName},\n\nPlease find attached your lease agreement.\n\nThank you.`,
        };

        // Send the email using nodemailer
        const info = await transporter.sendMail(mailOptions);

        console.log('Email sent:', info.response);

        // Optionally, update the lease status to "Sent" after successful email dispatch
        lease.status = 'sent';
        await lease.save();

        return reply.code(200).send({ message: 'Lease sent successfully.' });

    } catch (err) {
        console.error('Error sending lease:', err.message);
        return reply.code(502).send({ error: 'Failed to send lease.' });
    }
};

module.exports = send_lease;
