const payservedb = require('payservedb');
const { sendSms } = require("../../../../../utils/send_new_sms");
const { sendEmail } = require("../../../../../utils/send_new_email");

const approve_rfq = async (request, reply) => {
    try {
        const { rfqId } = request.params;
        const { approve, comments = '', userId } = request.body;

        // Validate required inputs
        if (approve === undefined) {
            return reply.code(400).send({
                error: 'Approval decision is required (true for approve, false for reject)'
            });
        }
        if (!userId) {
            return reply.code(400).send({
                error: 'userId is required in the request body'
            });
        }

        // Find the RFQ document directly from the main model
        const rfqRequest = await payservedb.RFQDetails.findById(rfqId);
        if (!rfqRequest) {
            return reply.code(404).send({ error: 'RFQ request not found' });
        }

        // Locate the current approval step
        const currentStepIndex = rfqRequest.approvals.findIndex(
            step => step.stepNumber === rfqRequest.currentStep
        );
        if (currentStepIndex === -1) {
            return reply.code(400).send({ error: 'Current approval step not found' });
        }
        const currentStep = rfqRequest.approvals[currentStepIndex];

        // Check that this userId is in the approvers list for the current step
        const approverIndex = currentStep.approvers.findIndex(
            approver => String(approver.userId) === String(userId)
        );
        if (approverIndex === -1) {
            return reply.code(403).send({ error: 'You are not authorized to approve this request' });
        }

        // Ensure they haven't already acted
        if (currentStep.approvers[approverIndex].status !== 'pending') {
            return reply.code(400).send({ error: 'You have already provided your decision' });
        }

        // Record the decision
        currentStep.approvers[approverIndex].status
            = approve ? 'approved' : 'rejected';
        currentStep.approvers[approverIndex].actionDate = new Date();
        currentStep.approvers[approverIndex].comments = comments;

        // Track if RFQ was fully approved for supplier notifications
        let wasFullyApproved = false;

        // Determine new overall approvalStatus/currentStep
        const allResponded = currentStep.approvers.every(a => a.status !== 'pending');
        if (allResponded) {
            const allApproved = currentStep.approvers.every(a => a.status === 'approved');
            if (allApproved) {
                // advance to next step, or finalize
                const nextExists = rfqRequest.approvals.some(
                    step => step.stepNumber === rfqRequest.currentStep + 1
                );
                if (nextExists) {
                    rfqRequest.currentStep += 1;
                    rfqRequest.approvalStatus = 'in_progress';
                    rfqRequest.status = 'Active'; // Change status to Active when in progress
                } else {
                    rfqRequest.currentStep = null;
                    rfqRequest.approvalStatus = 'approved';
                    rfqRequest.status = 'Active'; // Fully approved RFQ becomes Active
                    wasFullyApproved = true; // Set flag for supplier notifications
                }
            } else {
                // any rejection => fully rejected
                rfqRequest.currentStep = null;
                rfqRequest.approvalStatus = 'rejected';
                rfqRequest.status = 'Pending'; // Go back to Pending if rejected
            }
        } else {
            // still waiting on other approvers
            rfqRequest.approvalStatus = 'in_progress';
        }

        // Persist changes
        await rfqRequest.save();

        // Send notifications to suppliers if RFQ was fully approved
        if (wasFullyApproved && rfqRequest.suppliers && rfqRequest.suppliers.length > 0) {
            try {

                // Get facility details for notifications
                const facilityDetails = await payservedb.Facility.findById(rfqRequest.facilityId).lean();
                const facilityName = facilityDetails?.name || 'your facility';

                // Create login link (adjust URL as needed for your application)
                const loginLink = process.env.SUPPLIER_PORTAL_URL || 'https://supplier.payserve.co.ke/login';

                // Get supplier details and send notifications
                const supplierUsers = await payservedb.User.find({
                    _id: { $in: rfqRequest.suppliers }
                }).lean();

                const notificationPromises = supplierUsers.map(async (supplier) => {
                    try {
                        // Create personalized messages
                        const emailSubject = `RFQ Approved - Submit Your Response`;

                        const emailMessage = `
Dear ${supplier.fullName},

We are pleased to inform you that RFQ "${rfqRequest.name}" (${rfqRequest.rfqNumber}) has been approved and is now active.

RFQ Details:
- Name: ${rfqRequest.name}
- RFQ Number: ${rfqRequest.rfqNumber}
- Closing Date: ${new Date(rfqRequest.closingDate).toLocaleDateString()}
- Facility: ${facilityName}

Please log in to the supplier portal to view the full RFQ details and submit your response.

Login here: ${loginLink}

Important: Ensure you submit your response before the closing date.

For any questions or support, please contact us.

Best regards,
${facilityName} Procurement Team
                        `.trim();

                        const emailHtml = `
<h2>RFQ Approved - Action Required</h2>
<p>Dear ${supplier.fullName},</p>

<p>We are pleased to inform you that RFQ "<strong>${rfqRequest.name}</strong>" (${rfqRequest.rfqNumber}) has been approved and is now active.</p>

<h3>RFQ Details:</h3>
<ul>
    <li><strong>Name:</strong> ${rfqRequest.name}</li>
    <li><strong>RFQ Number:</strong> ${rfqRequest.rfqNumber}</li>
    <li><strong>Closing Date:</strong> ${new Date(rfqRequest.closingDate).toLocaleDateString()}</li>
    <li><strong>Facility:</strong> ${facilityName}</li>
</ul>

<p>Please log in to the supplier portal to view the full RFQ details and submit your response.</p>

<p><a href="${loginLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login to Supplier Portal</a></p>

<p><strong>Important:</strong> Ensure you submit your response before the closing date.</p>

<p>For any questions or support, please contact us.</p>

<p>Best regards,<br>${facilityName} Procurement Team</p>
                        `;

                        const smsMessage = `Dear ${supplier.fullName}, RFQ "${rfqRequest.name}" (${rfqRequest.rfqNumber}) is now active. Submit your response by ${new Date(rfqRequest.closingDate).toLocaleDateString()}. Login: ${loginLink}`;

                        // Send email notification
                        if (supplier.email) {
                            await sendEmail(
                                rfqRequest.facilityId,
                                supplier.email,
                                emailSubject,
                                emailMessage,
                                emailHtml,
                                facilityName
                            );
                        }

                        // Send SMS notification
                        if (supplier.phoneNumber) {
                            await sendSms(
                                rfqRequest.facilityId,
                                supplier.phoneNumber,
                                smsMessage
                            );
                        }

                    } catch (supplierNotificationError) {
                       
                        // Continue with other suppliers even if one fails
                    }
                });

                // Wait for all notifications to complete
                await Promise.allSettled(notificationPromises);

                

            } catch (notificationError) {
                
                // Don't fail the approval process just because notifications failed
            }
        }

        // Re-fetch to get populated details if needed
        const updated = await payservedb.RFQDetails
            .findById(rfqId)
            .populate('approvals.approvers.userId', 'name email')
            .lean();

        return reply.code(200).send({
            message: approve ? 'RFQ request approved' : 'RFQ request rejected',
            data: updated
        });
    } catch (err) {
        console.error('Error in approve_rfq:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = approve_rfq;