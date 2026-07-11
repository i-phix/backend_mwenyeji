const payservedb = require('payservedb');
const path = require('path');
const { getModel } = require('../../../utils/getModel');

const FinishReview = async (request, reply) => {
    try {
        const { facilityId, ticketId } = request.params;
        const {
            needsFix,
            reviewText,
            payer,
            payerType,
            requester,
            description,
            totalAmount,
            services,
            propertyManagerPhoneNumber,
        } = request.body;

        const filteredPropertyManagerPhoneNumber = propertyManagerPhoneNumber.trim().slice(-9);

        // Handle services field safely
        let serviceArray = [];
        if (typeof services === 'string') {
            try {
                serviceArray = JSON.parse(services);
            } catch (err) {
                console.error("Error parsing services:", err);
                return reply.code(400).send({ error: 'Invalid services format' });
            }
        } else if (Array.isArray(services)) {
            serviceArray = services;
        } else {
            return reply.code(400).send({ error: 'Services must be an array or JSON string' });
        }

        // Ensure `totalAmount` is a number
        const parsedTotalAmount = parseFloat(totalAmount);
        if (isNaN(parsedTotalAmount)) {
            return reply.code(400).send({ error: 'Invalid total amount' });
        }

        const processImages = (request) => {
            const imageFiles = request.files?.images || []; // safely get the array of images
            return imageFiles.map(file =>
                `${request.protocol}://${request.headers.host}/uploads/${path.basename(file.path)}`
            );
        };

        const images = processImages(request);

        const costAttachment = request.files?.costAttachment
            ? `${request.protocol}://${request.headers.host}/uploads/${path.basename(request.files.costAttachment[0].path)}`
            : null;

        // Get the ticket model for the facility
        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        // Find the ticket by its ID
        const ticket = await ticketModel.findById(ticketId);
        if (!ticket) {
            return reply.code(404).send({ error: 'Ticket not found' });
        }

        ticket.status = 'under review';
        ticket.reviewed = true;
        await ticket.save();

        // Update the ticket details
        const updatedTicket = await ticketModel.findByIdAndUpdate(
            ticketId,
            {
                needsFix,
                reviewText,
                payer,
                payerType,
                assessImages: images,
                costAttachment: costAttachment,
                reviewFinishedAt: new Date(),
                services: serviceArray,
                totalAmount: parsedTotalAmount,
            },
            { new: true }
        );

        if (!updatedTicket) {
            return reply.code(404).send({ error: 'Failed to update ticket' });
        }

        // Get the work order model for the facility
        const workOrderModel = await getModel('WorkOrder', payservedb.WorkOrder.schema, facilityId);

        // Create a new work order
        const orderNumber = Math.floor(Math.random() * 100000);
        const newWorkOrder = await workOrderModel.create({
            facilityId,
            requester,
            description,
            pricing: parsedTotalAmount,
            status: 'pending',
            type: 'unscheduled',
            orderNumber,
        });

        return reply.code(200).send({
            message: 'Ticket Review Finished and Work Order Created Successfully',
            ticket: updatedTicket,
            workOrder: newWorkOrder,
            note: 'SMS notifications will be sent after ticket approval'
        });
    } catch (err) {
        console.error('Error in finishing review and creating work order:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = FinishReview;