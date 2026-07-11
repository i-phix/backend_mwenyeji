const payservedb = require('payservedb');
const path = require('path');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

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

        if (payerType === 'tenant') {
            // If payer is a specific tenant ID, fetch that customer
            const customer = await payservedb.Customer.findById(payer);

            if (customer && customer.phoneNumber) {
                // const baseUrl = "https://resident.payserve.co.ke/resident/approvals/minimal_approval";
                const baseUrl = "https://resident.sandbox.payserve.co.ke/resident/approvals/minimalApproval";
                const actionLink = `${baseUrl}/${facilityId}/${ticket._id}`;
                const message = `Your maintenance ticket has been reviewed. The total amount for services is ${parsedTotalAmount}, and it has been determined that this amount is to be covered by you. Click on the link to accept or deny: ${actionLink}`;
                sendSms(facilityId, customer.phoneNumber, message);
                sendEmail(facilityId, customer.email, 'Ticket Review', message);
            }
        }

        if (payerType === 'propertyManager' && propertyManagerPhoneNumber) {
            const message = `The ticket review is complete. The total amount for services is ${parsedTotalAmount}. Please review and proceed.`;
            sendSms(facilityId, filteredPropertyManagerPhoneNumber, message);
        }

        if (payerType === 'landlord') {
            // If payer is a specific landlord ID, fetch that customer
            const landlordCustomer = await payservedb.Customer.findById(payer);

            if (landlordCustomer && landlordCustomer.phoneNumber) {
                const landlordPhoneNumber = landlordCustomer.phoneNumber.trim().slice(-9);
                const message = `Your property has a pending maintenance charge of ${parsedTotalAmount}. Please review your tickets and approve the payment.`;
                sendSms(facilityId, landlordPhoneNumber, message);
                sendEmail(facilityId, landlordCustomer.email, 'Ticket Review', message);
            } else {
                console.log('No phone number found for selected landlord.');
            }
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
        });
    } catch (err) {
        console.error('Error in finishing review and creating work order:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = FinishReview;


