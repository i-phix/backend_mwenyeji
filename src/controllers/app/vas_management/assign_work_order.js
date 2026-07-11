const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const axios = require('axios');

const assign_work_order = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            requesterId,
            description,
            pricing,
            assigneeId,
            type,
        } = request.body;

        // Validate required fields
        if (!facilityId || !requesterId || !assigneeId) {
            throw new Error('Missing required fields');
        }

        // Generate order number first
        const orderNumber = Math.floor(Math.random() * 100000);
        console.log('Generated order number:', orderNumber);

        // Get vendor using assignee ID
        const VasVendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);
        if (!VasVendor) throw new Error('Failed to get VasVendor model');

        const vendor = await VasVendor.findById(assigneeId);
        if (!vendor) throw new Error('Vendor not found');

        // Save work order
        const WorkOrder = await getModel('WorkOrder', payservedb.WorkOrder.schema, facilityId);
        if (!WorkOrder) throw new Error('Failed to get WorkOrder model');

        const workOrderData = {
            facilityId: new mongoose.Types.ObjectId(facilityId),
            requester: new mongoose.Types.ObjectId(requesterId),
            description,
            pricing,
            status: 'pending',
            type,
            orderNumber,
            assignee: new mongoose.Types.ObjectId(assigneeId),
        };

        const newWorkOrder = new WorkOrder(workOrderData);
        const savedWorkOrder = await newWorkOrder.save();

        //Construct and send message
        const messageBody = `Hello ${vendor.name}, you have a new work order #${orderNumber}: ${description}. Login to view details.`;
        sendMessageToQueue(
            'Payserve',
            vendor.contactDetails.phone,
            '',
            messageBody,
            'SMS Meliora'
        );
        return reply.code(200).send({
            success: true,
            message: 'Work Order assigned successfully',
            workOrder: savedWorkOrder,
        });
    } catch (err) {
        console.error('Error in assigning WorkOrder:', err);
        return reply.code(400).send({
            success: false,
            error: err.message
        });
    }
};

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

        // Send the message payload to the API endpoint
        const response = await axios.post('http://localhost:4006/api/messaging', messagePayload);

        // Log or handle the response
        console.log('Message sent successfully:', response.data);

    } catch (error) {

        // Log the error in case of failure
        console.error('Error sending message to queue:', error.message);
        logger.error(`Error sending message to queue: ${error.message}`);
    }
};

module.exports = assign_work_order;