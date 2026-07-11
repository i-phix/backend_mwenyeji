const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_booking_refunds = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    if (!facilityId) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID is required'
      });
    }

    const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
    const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
    const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facilityId);

    const reservations = await BookingReservation.find({
      facilityId,
      status: 'cancelled',
      'cancellationDetails.refundAmount': { $gt: 0 }
    }).lean();

    const refunds = [];
    const summary = {};

    for (const reservation of reservations) {
      const unit = reservation.unitId ? await Unit.findById(reservation.unitId).lean() : null;
      const invoice = await BookingInvoice.findOne({
        bookingReservationId: reservation._id,
        facilityId
      }).lean();

      const currencyCode = invoice?.currencyDetails?.code || invoice?.currency?.code || invoice?.currency?.currencyShortCode || 'USD';
      summary[currencyCode] = summary[currencyCode] || { count: 0, total: 0 };
      summary[currencyCode].count += 1;
      summary[currencyCode].total += Number(reservation.cancellationDetails?.refundAmount || 0);

      refunds.push({
        reservationId: reservation._id,
        bookingReservationId: reservation.bookingReservationId,
        guestName: reservation.guestInfo?.name || 'Guest',
        unitName: unit?.name || unit?.unitNumber || 'N/A',
        refundAmount: reservation.cancellationDetails?.refundAmount || 0,
        refundStatus: reservation.cancellationDetails?.refundStatus || 'Pending',
        refundReference: reservation.cancellationDetails?.refundReference || '',
        refundRequestedAt: reservation.cancellationDetails?.refundRequestedAt || reservation.cancellationDetails?.date,
        refundApprovedAt: reservation.cancellationDetails?.refundApprovedAt || null,
        refundPaymentId: reservation.cancellationDetails?.refundPaymentId || null,
        invoiceNumber: invoice?.invoiceNumber || invoice?.invoiceId || '',
        currencyCode
      });
    }

    return reply.code(200).send({
      success: true,
      data: {
        refunds,
        summary
      }
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: error.message || 'Failed to fetch booking refunds'
    });
  }
};

module.exports = get_booking_refunds;
