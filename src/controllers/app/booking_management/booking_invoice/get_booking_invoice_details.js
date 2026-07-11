const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Fetch detailed information for a specific booking invoice
 */
const fetch_invoice_details = async (request, reply) => {
    try {
        const { facilityId, invoiceId } = request.params;

        // Get models with facility context
        const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facilityId);
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);
        const Customer = await getModel('Customer', payservedb.Customer.schema); // Main collection - no facility context

        console.log('Searching for invoice with ID:', invoiceId, 'in facility:', facilityId);

        // Find invoice by ID or invoice number
        let invoice;
        if (mongoose.Types.ObjectId.isValid(invoiceId)) {
            invoice = await BookingInvoice.findOne({
                _id: invoiceId,
                facilityId
            }).lean();
        } else {
            // Try to find by invoice number or invoice ID string
            invoice = await BookingInvoice.findOne({
                $or: [
                    { invoiceNumber: invoiceId },
                    { invoiceId: invoiceId }
                ],
                facilityId
            }).lean();
        }

        if (!invoice) {
            console.log('Invoice not found with the given criteria');
            return reply.code(404).send({
                success: false,
                error: 'Invoice not found'
            });
        }

        console.log('Found invoice:', invoice._id);

        // Get reservation details
        const reservation = await BookingReservation.findById(invoice.bookingReservationId)
            .select('status bookingReservationId specialRequests guests paymentTiming commission landlordAmount revenueProcessed bookingPropertyId cancellationDetails statusHistory')
            .lean();

        console.log('Found reservation:', reservation ? reservation._id : 'Not found');

        // Get booking property details
        const bookingProperty = await BookingProperty.findById(reservation?.bookingPropertyId)
            .select('propertyName propertyType commission managedByLandlord')
            .lean();

        // Get unit details
        const unit = await Unit.findById(invoice.unitId)
            .select('name unitType division floorUnitNo homeOwnerId address description amenities')
            .lean();

        // Get currency details
        const currency = await Currency.findById(invoice.currencyId)
            .select('currencyName currencyShortCode exchangeRate')
            .lean();

        // Get home owner details (from main customer collection)
        let homeOwner = null;
        if (unit?.homeOwnerId) {
            homeOwner = await Customer.findById(unit.homeOwnerId)
                .select('firstName lastName email phoneNumber customerNumber customerType address')
                .lean();
        }

        // Calculate booking details
        const checkIn = new Date(invoice.checkIn);
        const checkOut = new Date(invoice.checkOut);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        // Calculate financial totals
        const additionalServicesTotal = (invoice.additionalServices || [])
            .reduce((sum, service) => sum + (service.price * (service.quantity || 1)), 0);

        const paymentTotal = (invoice.paymentHistory || [])
            .reduce((sum, payment) => sum + payment.amount, 0);

        const balanceRemaining = invoice.totalAmount - paymentTotal;
        const isOverdue = new Date() > new Date(invoice.dueDate) && invoice.paymentStatus !== 'Paid';

        // Calculate commission and landlord amounts
        const commissionRate = bookingProperty?.commission || 0;
        const commissionAmount = (invoice.totalAmount * commissionRate) / 100;
        const landlordAmount = invoice.totalAmount - commissionAmount;

        // Build comprehensive invoice details
        const invoiceDetails = {
            // Basic invoice information
            ...invoice,

            // Enhanced reservation data
            reservationDetails: reservation ? {
                id: reservation._id,
                status: reservation.status,
                bookingReservationId: reservation.bookingReservationId,
                specialRequests: reservation.specialRequests,
                guests: reservation.guests,
                paymentTiming: reservation.paymentTiming,
                commission: reservation.commission,
                landlordAmount: reservation.landlordAmount,
                revenueProcessed: reservation.revenueProcessed,
                cancellationDetails: reservation.cancellationDetails || null,
                statusHistory: reservation.statusHistory || []
            } : null,

            // Enhanced property data
            propertyDetails: bookingProperty ? {
                propertyName: bookingProperty.propertyName,
                propertyType: bookingProperty.propertyType,
                commission: bookingProperty.commission,
                managedByLandlord: bookingProperty.managedByLandlord
            } : null,

            // Enhanced unit data
            unitDetails: unit ? {
                id: unit._id,
                name: unit.name,
                unitType: unit.unitType,
                division: unit.division,
                floorUnitNo: unit.floorUnitNo,
                address: unit.address,
                description: unit.description,
                amenities: unit.amenities
            } : null,

            // Enhanced currency data
            currencyDetails: currency ? {
                id: currency._id,
                name: currency.currencyName,
                code: currency.currencyShortCode,
                exchangeRate: currency.exchangeRate
            } : null,

            // Home owner data
            homeOwnerDetails: homeOwner ? {
                id: homeOwner._id,
                name: `${homeOwner.firstName || ''} ${homeOwner.lastName || ''}`.trim(),
                email: homeOwner.email,
                phone: homeOwner.phoneNumber,
                customerNumber: homeOwner.customerNumber,
                customerType: homeOwner.customerType,
                address: homeOwner.address
            } : null,

            // Calculated financial data (named calculatedData for frontend compatibility)
            calculatedData: {
                nights: nights,
                pricePerNight: invoice.basePrice || 0,
                subtotal: (invoice.basePrice || 0) * nights,
                additionalServicesTotal: additionalServicesTotal,
                discountAmount: invoice.discountAmount || 0,
                taxAmount: invoice.taxAmount || 0,
                totalAmount: invoice.totalAmount,
                totalPaid: paymentTotal,
                balanceRemaining: balanceRemaining,
                commissionRate: commissionRate,
                commissionAmount: commissionAmount,
                landlordAmount: landlordAmount,
                isOverdue: isOverdue,
                daysPastDue: isOverdue ? Math.ceil((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24)) : 0
            },

            // Formatted dates for easy display
            formattedDates: {
                issueDate: invoice.issueDate.toISOString().split('T')[0],
                dueDate: invoice.dueDate.toISOString().split('T')[0],
                checkIn: invoice.checkIn.toISOString().split('T')[0],
                checkOut: invoice.checkOut.toISOString().split('T')[0],
                issueDateFormatted: invoice.issueDate.toLocaleDateString(),
                dueDateFormatted: invoice.dueDate.toLocaleDateString(),
                checkInFormatted: invoice.checkIn.toLocaleDateString(),
                checkOutFormatted: invoice.checkOut.toLocaleDateString()
            },

            // Payment summary
            paymentSummary: {
                totalPayments: (invoice.paymentHistory || []).length,
                lastPaymentDate: (invoice.paymentHistory || []).length > 0
                    ? Math.max(...(invoice.paymentHistory || []).map(p => new Date(p.date)))
                    : null,
                paymentMethods: [...new Set((invoice.paymentHistory || []).map(p => p.paymentMethod))]
            }
        };

        console.log('Sending response with invoice data:', {
            invoiceId: invoiceDetails._id,
            invoiceNumber: invoiceDetails.invoiceNumber,
            guestName: invoiceDetails.guestInfo?.name
        });

        return reply.code(200).send({
            success: true,
            message: 'Invoice details retrieved successfully',
            data: invoiceDetails
        });

    } catch (error) {
        console.error('Error fetching invoice details:', error);
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while fetching invoice details'
        });
    }
};

module.exports = fetch_invoice_details;
