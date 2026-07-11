const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Fetch booking invoices for a facility
 * Supports filtering, pagination, and sorting
 */
const get_all_booking_invoices = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            page = 1,
            limit = 20,
            status,
            paymentStatus,
            guestName,
            invoiceNumber,
            startDate,
            endDate,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = request.query;

        // Get models with facility context
        const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facilityId);
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);
        const Customer = await getModel('Customer', payservedb.Customer.schema); // Main collection - no facility context

        // Build filter object
        const filter = { facilityId };

        // Apply filters
        if (status) {
            filter.status = status;
        }

        if (paymentStatus) {
            filter.paymentStatus = paymentStatus;
        }

        if (invoiceNumber) {
            filter.$or = [
                { invoiceNumber: { $regex: invoiceNumber, $options: 'i' } },
                { invoiceId: { $regex: invoiceNumber, $options: 'i' } }
            ];
        }

        if (guestName) {
            filter['guestInfo.name'] = { $regex: guestName, $options: 'i' };
        }

        if (startDate || endDate) {
            filter.issueDate = {};
            if (startDate) {
                filter.issueDate.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.issueDate.$lte = new Date(endDate);
            }
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Fetch invoices with pagination
        const [invoices, totalCount] = await Promise.all([
            BookingInvoice.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            BookingInvoice.countDocuments(filter)
        ]);

        // Enhance invoices with additional data
        const enhancedInvoices = await Promise.all(
            invoices.map(async (invoice) => {
                try {
                    // Get reservation details
                    const reservation = await BookingReservation.findById(invoice.bookingReservationId)
                        .select('status bookingReservationId specialRequests guests')
                        .lean();

                    // Get unit details
                    const unit = await Unit.findById(invoice.unitId)
                        .select('name unitType division floorUnitNo homeOwnerId')
                        .lean();

                    // Get currency details
                    const currency = await Currency.findById(invoice.currencyId)
                        .select('currencyName currencyShortCode exchangeRate')
                        .lean();

                    // Get home owner details (from main customer collection)
                    let homeOwner = null;
                    if (unit?.homeOwnerId) {
                        homeOwner = await Customer.findById(unit.homeOwnerId)
                            .select('firstName lastName email phoneNumber customerNumber customerType')
                            .lean();
                    }

                    // Calculate booking duration
                    const checkIn = new Date(invoice.checkIn);
                    const checkOut = new Date(invoice.checkOut);
                    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

                    // Calculate totals
                    const additionalServicesTotal = (invoice.additionalServices || [])
                        .reduce((sum, service) => sum + (service.price * (service.quantity || 1)), 0);

                    const paymentTotal = (invoice.paymentHistory || [])
                        .reduce((sum, payment) => sum + payment.amount, 0);

                    return {
                        ...invoice,
                        // Enhanced reservation data
                        reservationDetails: reservation ? {
                            status: reservation.status,
                            bookingReservationId: reservation.bookingReservationId,
                            specialRequests: reservation.specialRequests,
                            guests: reservation.guests
                        } : null,

                        // Enhanced unit data
                        unitDetails: unit ? {
                            name: unit.name,
                            unitType: unit.unitType,
                            division: unit.division,
                            floorUnitNo: unit.floorUnitNo
                        } : null,

                        // Enhanced currency data
                        currencyDetails: currency ? {
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
                            customerType: homeOwner.customerType
                        } : null,

                        // Calculated fields
                        calculatedData: {
                            nights: nights,
                            additionalServicesTotal: additionalServicesTotal,
                            totalPaid: paymentTotal,
                            balanceRemaining: invoice.totalAmount - paymentTotal,
                            isOverdue: new Date() > new Date(invoice.dueDate) && invoice.paymentStatus !== 'Paid'
                        },

                        // Formatted dates
                        formattedDates: {
                            issueDate: invoice.issueDate.toISOString().split('T')[0],
                            dueDate: invoice.dueDate.toISOString().split('T')[0],
                            checkIn: invoice.checkIn.toISOString().split('T')[0],
                            checkOut: invoice.checkOut.toISOString().split('T')[0]
                        }
                    };
                } catch (enhanceError) {
                    console.error(`Error enhancing invoice ${invoice._id}:`, enhanceError);
                    return invoice; // Return original invoice if enhancement fails
                }
            })
        );

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / limitNum);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        // Calculate currency-specific summaries
        const currencySummaries = {};
        enhancedInvoices.forEach(inv => {
            const currencyCode = inv.currencyDetails?.code || 'USD';
            if (!currencySummaries[currencyCode]) {
                currencySummaries[currencyCode] = {
                    totalAmount: 0,
                    totalPaid: 0,
                    balanceRemaining: 0
                };
            }
            currencySummaries[currencyCode].totalAmount += inv.totalAmount || 0;
            currencySummaries[currencyCode].totalPaid += inv.calculatedData?.totalPaid || 0;
            currencySummaries[currencyCode].balanceRemaining += inv.calculatedData?.balanceRemaining || 0;
        });

        // Prepare response
        const response = {
            invoices: enhancedInvoices,
            pagination: {
                currentPage: parseInt(page),
                totalPages: totalPages,
                totalCount: totalCount,
                hasNextPage: hasNextPage,
                hasPrevPage: hasPrevPage,
                limit: limitNum
            },
            summary: {
                totalInvoices: totalCount,
                overdueCount: enhancedInvoices.filter(inv => inv.calculatedData?.isOverdue).length,
                byCurrency: currencySummaries
            }
        };

        return reply.code(200).send({
            success: true,
            message: `Retrieved ${enhancedInvoices.length} booking invoices`,
            data: response
        });

    } catch (error) {
        console.error('Error fetching booking invoices:', error);
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while fetching booking invoices'
        });
    }
};

module.exports = get_all_booking_invoices;