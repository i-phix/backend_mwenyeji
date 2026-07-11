/**
 * Controller to send invoice to property manager
 */
const mongoose = require('mongoose');
const axios = require('axios');
const { getModel } = require('../../../utils/getModel');
const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { sendSms } = require("../../../utils/send_new_sms");

/**
 * Send invoice notification to property manager
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<Object>} - Success/error response
 */
const send_invoice_to_manager = async (request, reply) => {
  try {
    // Get facilityId and invoiceId from URL parameters
    const { facilityId, invoiceId } = request.params;

    // Get manager details from request body
    const {
      managerId,
      managerEmail,
      managerName,
      invoiceNumber,
      clientName,
      unitName,
      amount,
      dueDate
    } = request.body;

    // Validate required fields
    if (!facilityId || !invoiceId || !managerId || !managerEmail) {
      throw new Error('Missing required fields: facilityId, invoiceId, managerId, and managerEmail are required');
    }

    // Log request data for debugging
    logger.info(`Sending invoice ${invoiceId} to property manager ${managerId} in facility ${facilityId}`);

    // Get invoice from facility database to ensure it exists
    const Invoice = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
    if (!Invoice) throw new Error('Failed to get Invoice model');

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }

    // Get the User model from payservedb
    const User = mongoose.model('User', payservedb.User.schema);
    
    // Verify that the manager exists and is of a valid type
    const manager = await User.findById(managerId).lean();
    if (!manager) {
      throw new Error(`Property manager with ID ${managerId} not found`);
    }
    
    // Check if manager is enabled and has a valid type
    if (manager.isEnabled === false) {
      throw new Error(`Property manager account is disabled`);
    }
    
    if (!['Company', 'Project Manager'].includes(manager.type)) {
      throw new Error(`Invalid user type for property manager: ${manager.type}`);
    }

    // Get facility name
    const Facility = mongoose.model('Facility', payservedb.Facility.schema);
    const facility = await Facility.findById(facilityId).select('name').lean();
    const facilityName = facility?.name || 'Your Property';

    // Format due date
    const formattedDueDate = new Date(dueDate).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Format amount
    const formattedAmount = parseFloat(amount).toLocaleString();

    // Create invoice link for management portal
    const invoiceLink = `${process.env.REACT_APP_BASE_URL || 'https://app.payserve.co.ke'}/facility/levy_management/invoice/${invoiceId}`;

    // Check if this manager has already been notified
    const existingInvoice = await Invoice.findById(invoiceId);
    let managerAlreadyNotified = false;
    
    if (existingInvoice && existingInvoice.managerNotifications) {
      managerAlreadyNotified = existingInvoice.managerNotifications.some(
        notification => notification.managerId === managerId
      );
    }
    
    // Prepare notification record
    const notificationRecord = {
      date: new Date(),
      managerId: managerId,
      managerEmail: managerEmail,
      managerName: managerName,
      managerType: manager.type,
      notes: `Invoice ${managerAlreadyNotified ? 're-sent' : 'sent'} to property manager through the invoice management system`
    };
    
    // Create managerNotifications array if it doesn't exist
    if (!existingInvoice.managerNotifications) {
      await Invoice.findByIdAndUpdate(invoiceId, {
        $set: { managerNotifications: [notificationRecord] }
      });
    } else {
      // Update invoice with notification record
      await Invoice.findByIdAndUpdate(invoiceId, {
        $push: { managerNotifications: notificationRecord }
      });
    }

    // Create HTML email content
    const emailContent = `
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #2c3e50; margin-bottom: 5px;">Invoice Notification</h2>
                <p style="font-size: 16px; color: #7f8c8d;">${facilityName}</p>
            </div>
            
            <p>Dear ${managerName},</p>
            
            <p>This is to inform you that a new invoice has been issued for the following tenant:</p>
            
            <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #2c3e50;">Invoice Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">Tenant Name</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${clientName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">Unit</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${unitName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">Invoice Number</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${invoiceNumber}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">Amount</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">Ksh ${formattedAmount}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">Due Date</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${formattedDueDate}</td>
                    </tr>
                </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${invoiceLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">View Invoice</a>
            </div>
            
            <p>Please note that the tenant has been notified of this invoice. You can view the complete invoice details and payment status by clicking the button above.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #7f8c8d; font-size: 14px;">
                <p>Best regards,<br>${facilityName} Management</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Email subject
    const emailSubject = `Invoice Notification - ${clientName} - ${invoiceNumber}`;

    // Send email notification to property manager
    await sendMessageToQueue(
      'Payserve',
      managerEmail,
      emailSubject,
      emailContent,
      'EMAIL'
    );
    
    // Send SMS notification if manager has a phone number
    if (manager.phoneNumber || manager.phone) {
      try {
        const managerPhone = manager.phoneNumber || manager.phone;
        
        // Format phone number - remove any non-digit characters and take last 9 digits
        const phoneDigits = managerPhone.replace(/\D/g, '');
        const last9Digits = phoneDigits.slice(-9);
        
        if (last9Digits.length === 9) {
          // Create SMS message
          const smsMessage = `Invoice Alert: ${clientName} in unit ${unitName} has been issued invoice ${invoiceNumber} for KSh ${formattedAmount}. Due: ${formattedDueDate}. View details at ${invoiceLink}`;
          
          // Send SMS using new SMS utility
          await sendSMS(facilityId, last9Digits, smsMessage);
          
          logger.info(`SMS notification sent to property manager ${managerName} (${last9Digits}) for invoice ${invoiceNumber}`);
        } else {
          logger.warn(`Invalid phone number format for property manager: ${managerPhone}`);
        }
      } catch (smsError) {
        logger.error(`Failed to send SMS notification to property manager: ${smsError.message}`, { stack: smsError.stack });
        // Continue with execution, don't throw
      }
    }

    return reply.code(200).send({
      success: true,
      message: 'Invoice sent to property manager successfully',
      details: {
        invoiceId: invoiceId,
        managerId: managerId,
        managerEmail: managerEmail,
        smsNotification: !!(manager.phoneNumber || manager.phone)
      }
    });
  } catch (err) {
    logger.error(`Error sending invoice to property manager: ${err.message}`, { stack: err.stack });
    return reply.code(400).send({
      success: false,
      message: 'Failed to send invoice to property manager',
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
    throw error; // Rethrow for the calling function to handle
  }
};

module.exports = send_invoice_to_manager;