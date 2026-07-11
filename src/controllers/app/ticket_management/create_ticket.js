const payservedb = require('payservedb');
const path = require('path');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { getNextTicketNumber } = require('../../../utils/ticketNumberGeneration');

const CreateTicket = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      ticketType,
      subject,
      description,
      priority,
      date,
      userId,
      fullName,
      phoneNumber
    } = request.body;


    const processImages = (request) => {
      if (!request.files || request.files.length === 0) {
        return [];
      }

      return request.files.map(file =>
        `${request.protocol}://${request.headers.host}/uploads/${path.basename(file.path)}`
      );
    };

    const images = processImages(request);

    const ticketNumber = await getNextTicketNumber(facilityId);

    const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

    const newTicket = await ticketModel.create({
      ticketNumber: ticketNumber,
      ticketType,
      subject,
      description,
      priority,
      date,
      images: images,
      userId: userId,
      facilityId: facilityId
    });

    const propertyManager = await payservedb.User.findOne({
      type: 'Company',
      'customerData.facilityId': facilityId,
      'customerData.isEnabled': true
    });

    if (!propertyManager) {
      console.warn(`No property manager found for facility: ${facilityId}`);
      return;
    }

    const message = `A new ticket, Ticket Number: ${ticketNumber}, has been raised by ${fullName}, phone Number : ${phoneNumber}, Please login to the system to review the ticket.`;

    sendSms(facilityId, propertyManager.phoneNumber, message);

    return reply.code(200).send({success: true, message: 'Ticket created successfully' });
  } catch (err) {
    console.error('Error in adding ticket:', err);
    return reply.code(400).send({ error: err.message });
  }
}

module.exports = CreateTicket