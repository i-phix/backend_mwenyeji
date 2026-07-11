const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_handover = async (request, reply) => {
    try {
        const { facilityId, handoverId } = request.params;

        // Validate required fields
        if (!handoverId) {
            return reply.code(400).send({ 
                success: false,
                error: 'Handover ID is required.' 
            });
        }

        let handoverModel;
        let unitModel;
        let handover;
        let unit;
        let relatedHandover;
        let unpaidInvoices = [];
        let defaultCurrency = null;

        try {
            // Dynamically fetch facility-specific models
            handoverModel = await getModel('Handover', payservedb.Handover.schema, facilityId);
            console.log('Successfully got Handover model');

            // Find the handover without using populate() to avoid cross-database issues
            handover = await handoverModel.findById(handoverId).lean();
            
            if (!handover) {
                return reply.code(404).send({ 
                    success: false,
                    error: `Handover with ID ${handoverId} does not exist.` 
                });
            }
            
            console.log('Found handover:', handover._id);

            // Now manually fetch related data
            
            // 1. Get Unit data
            try {
                unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
                if (handover.unitId) {
                    unit = await unitModel.findById(handover.unitId).lean();
                    if (unit) {
                        handover.unitId = {
                            _id: unit._id,
                            name: unit.name,
                            floorUnitNo: unit.floorUnitNo,
                            division: unit.division,
                            unitType: unit.unitType,
                            status: unit.status
                        };
                    }
                }
            } catch (unitError) {
                console.error('Error fetching unit data:', unitError.message);
                // Continue without unit data
            }
            
            // 2. Get Customer data from main database
            try {
                if (handover.customerId) {
                    const customer = await payservedb.Customer.findById(handover.customerId);
                    if (customer) {
                        handover.customerId = {
                            _id: customer._id,
                            firstName: customer.firstName,
                            lastName: customer.lastName,
                            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown Customer',
                            email: customer.email,
                            phoneNumber: customer.phoneNumber,
                            idNumber: customer.idNumber
                        };
                    }
                }
            } catch (customerError) {
                console.error('Error fetching customer data:', customerError.message);
                // Continue without customer data
            }
            
            // 3. Get related handover data if it's a move-out
            try {
                if (handover.handoverType === 'MoveOut' && handover.relatedHandoverId) {
                    relatedHandover = await handoverModel.findById(handover.relatedHandoverId).lean();
                    if (relatedHandover) {
                        handover.relatedHandoverId = relatedHandover;
                    }
                }
            } catch (relatedError) {
                console.error('Error fetching related handover:', relatedError.message);
                // Continue without related handover data
            }
            
            // 4. Get property manager data if available
            try {
                if (handover.propertyManagerId) {
                    const propertyManager = await payservedb.User.findById(handover.propertyManagerId);
                    if (propertyManager) {
                        handover.propertyManagerId = {
                            _id: propertyManager._id,
                            name: propertyManager.name,
                            email: propertyManager.email
                        };
                    }
                }
            } catch (managerError) {
                console.error('Error fetching property manager data:', managerError.message);
                // Continue without property manager data
            }

            // 5. Get default currency for display
            try {
                const currencyModel = await getModel('Currency', payservedb.Currency.schema, facilityId);
                const currencies = await currencyModel.find({}).lean();
                defaultCurrency = (currencies || []).find(curr => curr.isDefaultCurrency) || (currencies || [])[0] || null;
            } catch (currencyError) {
                console.error('Error fetching currency data:', currencyError.message);
            }

            // 6. Get unpaid invoices for this unit and customer
            try {
                const unitIdForQuery = (handover.unitId && typeof handover.unitId === 'object' && handover.unitId._id)
                    ? handover.unitId._id
                    : handover.unitId;
                const customerIdForQuery = (handover.customerId && typeof handover.customerId === 'object' && handover.customerId._id)
                    ? handover.customerId._id
                    : handover.customerId;

                if (unitIdForQuery && customerIdForQuery) {
                    const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
                    const rawInvoices = await invoiceModel.find({
                        'unit.id': unitIdForQuery,
                        'client.clientId': customerIdForQuery,
                        status: { $in: ['Unpaid', 'Overdue', 'Partially Paid'] }
                    })
                    .select({
                        _id: 1,
                        invoiceNumber: 1,
                        unit: 1,
                        totalAmount: 1,
                        amountPaid: 1,
                        issueDate: 1,
                        dueDate: 1,
                        status: 1,
                        whatFor: 1,
                        items: 1,
                        currency: 1,
                        balanceBroughtForward: 1
                    })
                    .lean();

                    if (Array.isArray(rawInvoices)) {
                        const invoicesWithBalance = rawInvoices.map(invoice => {
                            const balance = (invoice.totalAmount || 0) - (invoice.amountPaid || 0) +
                                ((invoice.balanceBroughtForward || 0) > 0 ? invoice.balanceBroughtForward : 0);
                            const currency = invoice.currency || defaultCurrency || null;
                            return {
                                ...invoice,
                                balance,
                                currency,
                                itemsSummary: Array.isArray(invoice.items) && invoice.items.length > 0
                                    ? invoice.items.map(item => item.description || '').join(', ')
                                    : 'No items',
                                formattedType: invoice.whatFor?.invoiceType || 'Unknown Type',
                                formattedDate: new Date(invoice.issueDate || Date.now()).toLocaleDateString(),
                                formattedDueDate: new Date(invoice.dueDate || Date.now()).toLocaleDateString()
                            };
                        });

                        unpaidInvoices = invoicesWithBalance.filter(invoice => (invoice.balance || 0) > 0);
                    }
                }
            } catch (invoiceError) {
                console.error('Error fetching unpaid invoices:', invoiceError.message);
            }

            // Validate handover data before sending
            if (!handover.items) {
                handover.items = [];
            } else if (!Array.isArray(handover.items)) {
                console.warn('Invalid items structure detected, converting to array');
                handover.items = [];
            }

            // Ensure attachments is an array and migrate legacy data
            if (!handover.attachments) {
                handover.attachments = [];
            } else if (!Array.isArray(handover.attachments)) {
                console.warn('Invalid attachments structure detected, converting to array');
                handover.attachments = [];
            } else {
                // Migrate legacy attachments: if 'name' exists but 'fileName' doesn't,
                // assume 'name' is actually the filename and needs migration
                handover.attachments = handover.attachments.map(att => {
                    if (att.name && !att.fileName) {
                        // Legacy format: name contains the filename
                        return {
                            ...att,
                            fileName: att.name,  // Original filename
                            name: ''             // Empty custom name (needs to be filled)
                        };
                    }
                    return att;
                });
            }

            // Enrich response for details view
            handover.unpaidInvoices = unpaidInvoices;
            handover.defaultCurrency = defaultCurrency
                ? {
                    _id: defaultCurrency._id,
                    currencyName: defaultCurrency.currencyName,
                    currencyShortCode: defaultCurrency.currencyShortCode,
                    isDefaultCurrency: defaultCurrency.isDefaultCurrency || false
                }
                : null;

            return reply.code(200).send({
                success: true,
                data: handover,
                handoverId: handover._id,
                facilityId: facilityId
            });
            
        } catch (modelError) {
            console.error('Error with models in get_handover:', modelError);
            return reply.code(500).send({ 
                success: false,
                error: `Database error: ${modelError.message}` 
            });
        }
    } catch (err) {
        console.error('Error in get_handover:', err);
        
        return reply.code(500).send({ 
            success: false,
            error: err.message || 'An error occurred while fetching the handover.'
        });
    }
};

module.exports = get_handover;
