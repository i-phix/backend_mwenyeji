const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const axios = require('axios');
const logger = require('../../../../config/winston');
const moment = require('moment');
const { sendSms } = require("../../../utils/send_new_sms");

/**
 * Endpoint to resend invoice notifications to clients
 * Uses the updated invoice notification format
 */
const resend_invoice_notification = async (request, reply) => {
    try {
        // Get facilityId from URL parameters
        const facilityId = request.params.facilityId;

        // Get other parameters from request body
        const {
            invoiceId,
            tenantId,
            unitName,
            facilityName,
            amount,
            dueDate,
            invoiceNumber,
            invoiceUrl
        } = request.body;

        // Validate required fields
        if (!facilityId || !invoiceId || !tenantId) {
            throw new Error('Missing required fields: facilityId, invoiceId, and tenantId are required');
        }

        // Log request data for debugging
        logger.info(`Resending invoice notification for invoice ${invoiceId} in facility ${facilityId}`);

        // Get customer/tenant information
        const Customer = mongoose.model('Customer', payservedb.Customer.schema);
        const tenant = await Customer.findById(tenantId).lean();

        if (!tenant) {
            throw new Error(`Tenant with ID ${tenantId} not found`);
        }

        // Get invoice from facility database to ensure it exists
        const Invoice = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        if (!Invoice) throw new Error('Failed to get Invoice model');

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            throw new Error(`Invoice with ID ${invoiceId} not found`);
        }

        // Determine if this is a lease or levy invoice
        const isLease = invoice.whatFor && invoice.whatFor.invoiceType === 'Lease';
        const invoiceType = isLease ? 'lease' : 'levy';

        // Get invoice type description (rent or levy name)
        let invoiceTypeDesc = '';
        if (isLease) {
            invoiceTypeDesc = 'rent';
        } else {
            // For levy invoices, try to get the actual levy name
            if (invoice.items && invoice.items.length > 0 && invoice.items[0].description) {
                const itemDesc = invoice.items[0].description;
                // Extract levy name from description which might be in format "LevyName - Period"
                const dashIndex = itemDesc.indexOf(' - ');
                invoiceTypeDesc = dashIndex > 0 ? itemDesc.substring(0, dashIndex) : itemDesc;
            } else if (invoice.whatFor && invoice.whatFor.name) {
                invoiceTypeDesc = invoice.whatFor.name;
            } else {
                invoiceTypeDesc = 'levy';
            }
        }

        // Format month/period for the invoice
        const currentDate = new Date(invoice.issueDate || Date.now());
        const month = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Calculate the total outstanding amount
        const invoiceAmount = amount || invoice.totalAmount || 0;
        const balanceBroughtForward = invoice.balanceBroughtForward > 0 ? invoice.balanceBroughtForward : 0;
        const amountPaid = invoice.amountPaid || 0;
        const totalOutstanding = (invoiceAmount + balanceBroughtForward) - amountPaid;

        // Format currency amounts
        const formattedAmount = invoiceAmount.toLocaleString();
        const formattedBalance = balanceBroughtForward.toLocaleString();
        const formattedTotalDue = totalOutstanding.toLocaleString();

        // Format due date
        const formattedDueDate = moment(dueDate || invoice.dueDate).format('MMM D, YYYY');

        // Get payment details
        let paybill = '';
        if (invoice.paymentDetails && invoice.paymentDetails.paymentMethod) {
            const paymentMethodParts = invoice.paymentDetails.paymentMethod.split(' - ');
            paybill = paymentMethodParts.length > 1 ? paymentMethodParts[1] : invoice.paymentDetails.paymentMethod;
        }

        // Get account number
        const accountNumber = invoice.accountNumber || '';

        // Ensure the URL uses resident.payserve.co.ke domain
        let clientInvoiceUrl = invoiceUrl || invoice.invoiceUrl || '';
        if (!clientInvoiceUrl) {
            // Generate a new URL if none exists
            clientInvoiceUrl = `${process.env.RESIDENT_PORTAL_URL || 'https://resident.payserve.co.ke'}/invoice/${facilityId}/${invoiceId}/${invoiceType}`;

            // Update the invoice with the new URL
            await Invoice.findByIdAndUpdate(invoiceId, { $set: { invoiceUrl: clientInvoiceUrl } });
        } else if (clientInvoiceUrl.includes('app.payserve.co.ke')) {
            clientInvoiceUrl = clientInvoiceUrl.replace('app.payserve.co.ke', 'resident.payserve.co.ke');
        }

        // Flag to track if any notifications were sent
        let notificationsSent = false;

        // Get client's first name only
        const firstName = tenant.firstName || tenant.fullName?.split(' ')[0] || '';

        // Additional info for the message
        const additionalInfo = `Due by: ${formattedDueDate}. Please pay on time to avoid penalties.`;

        // Format SMS message using the new format
        const smsMessage = `Dear ${firstName}, new ${invoiceTypeDesc} invoice for ${month}: Kes ${formattedAmount}. Previous balance: Kes ${formattedBalance}. Total balance: Kes ${formattedTotalDue}. Paybill ${paybill} Account number ${accountNumber}. ${additionalInfo} ${clientInvoiceUrl}`;

        // Send SMS notification if phone number exists
        if (tenant.phoneNumber) {
            try {
                // Format phone number - remove leading 0 if present
                const phoneNumber = tenant.phoneNumber.startsWith('0')
                    ? tenant.phoneNumber.slice(1)
                    : tenant.phoneNumber;

                // Send SMS using new SMS utility
                await sendSMS(facilityId, phoneNumber, smsMessage);

                notificationsSent = true;
                logger.info(`SMS notification sent to ${tenant.firstName} (${phoneNumber}) for invoice ${invoiceNumber || invoice.invoiceNumber}`);
            } catch (smsError) {
                logger.error(`Failed to send SMS notification: ${smsError.message}`, { stack: smsError.stack });
                // Continue with execution, don't throw
            }
        }

        // Send email notification if email exists
        if (tenant.email) {
            try {
                // Format email subject with the new format
                const emailSubject = `New ${invoiceTypeDesc} Invoice for ${month}`;

                // Format HTML email content with the new design
                const emailContent = `
                    <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="text-align: center; margin-bottom: 20px;">
                                <h2 style="color: #2c3e50; margin-bottom: 5px;">${invoiceTypeDesc.charAt(0).toUpperCase() + invoiceTypeDesc.slice(1)} Invoice</h2>
                                <p style="font-size: 16px; color: #7f8c8d;">${month}</p>
                            </div>
                            
                            <p>Dear ${firstName},</p>
                            
                            <p>${additionalInfo}</p>
                            
                            <div style="background-color: #f8f9fa; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #2c3e50;">Invoice Summary</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">Invoice Amount</td>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">Ksh ${formattedAmount}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">Previous Balance</td>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">Ksh ${formattedBalance}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Total Balance</strong></td>
                                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;"><strong>Ksh ${formattedTotalDue}</strong></td>
                                    </tr>
                                </table>
                            </div>
                            
                            <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #2c3e50;">Payment Information</h3>
                                <p><strong>Paybill Number:</strong> ${paybill}</p>
                                <p><strong>Account Number:</strong> ${accountNumber}</p>
                                <p><strong>Due Date:</strong> ${formattedDueDate}</p>
                                ${invoice.invoiceNumber ? `<p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>` : ''}
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${clientInvoiceUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">View Full Invoice</a>
                            </div>
                            
                            <p style="color: #7f8c8d; font-size: 14px;">If you have already made the payment, please disregard this notice.</p>
                            
                            <p>For any questions, please contact our billing team.</p>
                            
                            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #7f8c8d; font-size: 14px;">
                                <p>Best regards,<br>${facilityName} Management</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                // Send email
                await sendMessageToQueue(
                    'Payserve',
                    tenant.email,
                    emailSubject,
                    emailContent,
                    'EMAIL'
                );

                notificationsSent = true;
                logger.info(`Email notification sent to ${tenant.firstName} (${tenant.email}) for invoice ${invoiceNumber || invoice.invoiceNumber}`);
            } catch (emailError) {
                logger.error(`Failed to send email notification: ${emailError.message}`, { stack: emailError.stack });
                // Continue with execution, don't throw
            }
        }

        // If no phone or email was available
        if (!notificationsSent) {
            return reply.code(200).send({
                success: false,
                message: 'No notifications sent - tenant has no email or phone number',
            });
        }

        // Update invoice with notification record in reminderHistory
        await Invoice.findByIdAndUpdate(invoiceId, {
            $push: {
                reminderHistory: {
                    type: 'invoice',
                    date: new Date(),
                    daysOverdue: 0,
                    sentBy: {
                        sms: !!tenant.phoneNumber,
                        email: !!tenant.email
                    },
                    sentTo: tenant._id.toString(),
                    notes: 'Invoice notification resent manually through the invoice management system'
                }
            }
        });

        return reply.code(200).send({
            success: true,
            message: 'Invoice notifications sent successfully',
            details: {
                smsSent: !!tenant.phoneNumber,
                emailSent: !!tenant.email,
                invoiceId: invoiceId,
                recipient: firstName
            }
        });
    } catch (err) {
        logger.error(`Error in resending invoice notification: ${err.message}`, { stack: err.stack });
        return reply.code(400).send({
            success: false,
            message: 'Failed to send invoice notification',
            error: err.message
        });
    }
};

/**
 *  Send SMS using the updated utility function with correct parameters
 * @param {string} facilityId - Facility ID for SMS context
 * @param {string} phoneNumber - Phone number to send to
 * @param {string} message - Message content
 * @returns {Promise<Object>} Result of SMS sending value
 */
async function sendSMS(facilityId, phoneNumber, message) {
    try {
        console.log(`Sending SMS to ${phoneNumber} via new SMS service`);
        const smsResponse = await sendSms(facilityId, phoneNumber, message);
        console.log("SMS Response:", smsResponse);
        if (smsResponse && smsResponse.success) {
            console.log(
                `SMS notification sent successfully to ${phoneNumber} via ${smsResponse.method || 'unknown'}`
            );
            return {
                success: true,
                result: smsResponse,
                method: 'new_sms_service'
            };
        } else {
            console.warn(
                `SMS notification sending may have failed for ${phoneNumber}:`,
                smsResponse
            );
            return {
                success: false,
                error: "SMS response indicates failure",
                result: smsResponse,
                method: 'new_sms_service'
            };
        }
    } catch (smsError) {
        console.error(
            `Error sending SMS notification to ${phoneNumber}: ${smsError.message}`
        );
        console.error("SMS Error details:", smsError);
        return {
            success: false,
            error: smsError.message,
            method: 'new_sms_service'
        };
    }
}

/**
 * Helper function to send messages to the messaging queue
 * @param {string} user - User sending the message
 * @param {string} recipient - Phone number or email
 * @param {string} subject - Email subject (blank for SMS)
 * @param {string} messageBody - Content of the message
 * @param {string} type - Message type (SMS Meliora, EMAIL, etc.)
 * @returns {Promise<void>}
 */
const sendMessageToQueue = async (user, recipient, subject, messageBody, type) => {
    try {
        // Create the message payload
        const messagePayload = {
            user,
            recipient,
            subject, 
            type,
            message: messageBody,
        };

        // Get messaging service URL from environment variables or use default
        const messagingServiceUrl = process.env.MESSAGING_SERVICE_URL || 'http://localhost:4006/api/messaging';

        // Send the message payload to the API endpoint
        const response = await axios.post(messagingServiceUrl, messagePayload);

        // Log success
        logger.info(`Message sent successfully: ${type} to ${recipient}`);

    } catch (error) {
        // Log the error in case of failure
        logger.error(`Error sending message to queue: ${error.message}`, { stack: error.stack });
        // Don't throw - we want to continue even if one notification fails
    }
};

module.exports = resend_invoice_notification;