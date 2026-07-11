const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_lease_agreements = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Get facility-specific models
        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const currencyModel = await getModel('Currency', payservedb.Currency.schema, facilityId);
        const bankDetailsModel = await getModel('BankDetails', payservedb.BankDetails.schema, facilityId);

        // Fetch all leases for the facility
        const leases = await leaseAgreementModel.find({ facilityId });

        // Process each lease to include customer info and calculate total amounts
        const leasesWithCustomerInfo = await Promise.all(leases.map(async (lease) => {
            try {
                // Fetch related data
                const tenant = await payservedb.Customer.findById(lease.tenant);
                const landlord = await payservedb.Customer.findById(lease.landlord);
                const unit = await unitModel.findById(lease.unitNumber);
                const currency = await currencyModel.findById(lease.currency);

                // Fetch bank details if referenced
                let primaryBankDetails = null;
                if (lease.bankDetails) {
                    try {
                        primaryBankDetails = await bankDetailsModel.findById(lease.bankDetails);
                    } catch (bankError) {
                        console.error('Error fetching primary bank details:', bankError);
                    }
                }

                // Populate bank details for payment methods
                const populatedPaymentMethods = [];
                if (lease.financialTerms?.paymentMethods) {
                    for (const paymentMethod of lease.financialTerms.paymentMethods) {
                        const populatedMethod = { ...paymentMethod.toObject() };

                        if (paymentMethod.bankDetailsId) {
                            try {
                                const bankDetails = await bankDetailsModel.findById(paymentMethod.bankDetailsId);
                                if (bankDetails) {
                                    populatedMethod.bankDetails = {
                                        accountName: bankDetails.accountName,
                                        accountNumber: bankDetails.accountNumber,
                                        bankName: bankDetails.bankName,
                                        branchName: bankDetails.branchName,
                                        isDefault: bankDetails.isDefault
                                    };
                                }
                            } catch (bankError) {
                                console.error('Error fetching bank details for payment method:', bankError);
                            }
                        }

                        populatedPaymentMethods.push(populatedMethod);
                    }
                }

                // Calculate total amount including balance brought forward
                const monthlyRent = lease.financialTerms?.monthlyRent || 0;
                const balanceBroughtForward = lease.financialTerms?.balanceBroughtForward || 0;
                const totalAmount = monthlyRent + balanceBroughtForward;

                // Check if lease has active escalations
                const activeEscalations = lease.financialTerms?.escalations?.filter(
                    escalation => escalation.status === 'scheduled' &&
                        new Date(escalation.effectiveDate) <= new Date()
                ) || [];

                // Calculate escalated rent if there are active escalations
                let currentRent = monthlyRent;
                if (activeEscalations.length > 0) {
                    // Apply the most recent escalation
                    const latestEscalation = activeEscalations.reduce((latest, current) =>
                        new Date(current.effectiveDate) > new Date(latest.effectiveDate) ? current : latest
                    );

                    if (latestEscalation.type === 'percentage') {
                        currentRent = monthlyRent * (1 + latestEscalation.value / 100);
                    } else if (latestEscalation.type === 'fixed') {
                        currentRent = monthlyRent + latestEscalation.value;
                    }
                }

                // Calculate total with escalated rent
                const totalAmountWithEscalation = currentRent + balanceBroughtForward;

                const leaseObject = lease.toObject();

                // Update financial terms with populated payment methods
                if (populatedPaymentMethods.length > 0) {
                    leaseObject.financialTerms = {
                        ...leaseObject.financialTerms,
                        paymentMethods: populatedPaymentMethods
                    };
                }

                return {
                    ...leaseObject,
                    tenantInfo: tenant ? {
                        fullName: `${tenant.firstName} ${tenant.lastName}`,
                        email: tenant.email,
                        phoneNumber: tenant.phoneNumber
                    } : null,
                    landlordInfo: landlord ? {
                        fullName: `${landlord.firstName} ${landlord.lastName}`,
                        email: landlord.email,
                        phoneNumber: landlord.phoneNumber
                    } : null,
                    unitInfo: unit ? {
                        unitName: unit.name || unit.unitNumber,
                        unitType: unit.unitType,
                        floor: unit.floor
                    } : null,
                    currency: currency ? {
                        currencyName: currency.currencyName,
                        currencyShortCode: currency.currencyShortCode,
                        currencySymbol: currency.currencySymbol
                    } : null,
                    bankDetails: primaryBankDetails ? {
                        accountName: primaryBankDetails.accountName,
                        accountNumber: primaryBankDetails.accountNumber,
                        bankName: primaryBankDetails.bankName,
                        branchName: primaryBankDetails.branchName,
                        isDefault: primaryBankDetails.isDefault
                    } : null,

                    // Financial calculations
                    financialSummary: {
                        monthlyRent: monthlyRent,
                        balanceBroughtForward: balanceBroughtForward,
                        totalAmount: totalAmount, // Original rent + balance brought forward
                        currentRent: currentRent, // Rent after escalations
                        totalAmountWithEscalation: totalAmountWithEscalation, // Escalated rent + balance
                        hasEscalations: activeEscalations.length > 0,
                        activeEscalationsCount: activeEscalations.length,
                        securityDeposit: lease.financialTerms?.securityDeposit || 0
                    },

                    // Additional fields for frontend use
                    hasEscalations: lease.financialTerms?.escalations?.length > 0,
                    requiresLandlordApproval: Boolean(lease.requireLandlordApproval),

                    // Lease status information
                    isExpired: new Date(lease.leaseTerms?.endDate) < new Date(),
                    daysUntilExpiry: Math.ceil((new Date(lease.leaseTerms?.endDate) - new Date()) / (1000 * 60 * 60 * 24)),

                    // Document status
                    hasDocuments: lease.leaseDocuments && lease.leaseDocuments.length > 0,
                    documentsCount: lease.leaseDocuments?.length || 0,

                    // Payment information
                    hasPayments: lease.payments && lease.payments.length > 0,
                    paymentsCount: lease.payments?.length || 0,

                    // Reminder information
                    hasReminders: lease.reminders && lease.reminders.length > 0,
                    remindersCount: lease.reminders?.length || 0
                };
            } catch (itemError) {
                console.error(`Error processing lease ${lease._id}:`, itemError);

                // Return lease with minimal info if processing fails
                return {
                    ...lease.toObject(),
                    tenantInfo: null,
                    landlordInfo: null,
                    unitInfo: null,
                    currency: null,
                    financialSummary: {
                        monthlyRent: lease.financialTerms?.monthlyRent || 0,
                        balanceBroughtForward: lease.financialTerms?.balanceBroughtForward || 0,
                        totalAmount: (lease.financialTerms?.monthlyRent || 0) + (lease.financialTerms?.balanceBroughtForward || 0),
                        currentRent: lease.financialTerms?.monthlyRent || 0,
                        totalAmountWithEscalation: (lease.financialTerms?.monthlyRent || 0) + (lease.financialTerms?.balanceBroughtForward || 0),
                        hasEscalations: false,
                        activeEscalationsCount: 0,
                        securityDeposit: lease.financialTerms?.securityDeposit || 0
                    },
                    hasEscalations: false,
                    requiresLandlordApproval: Boolean(lease.requireLandlordApproval),
                    processingError: itemError.message
                };
            }
        }));

        // Return success response maintaining backward compatibility
        return reply.code(200).send({
            success: true,
            message: 'Lease agreements fetched successfully.',
            leaseAgreements: leasesWithCustomerInfo, // Keep this for backward compatibility
            data: {
                leaseAgreements: leasesWithCustomerInfo,
                totalCount: leasesWithCustomerInfo.length,
                summary: {
                    activeLeases: leasesWithCustomerInfo.filter(lease => lease.status === 'Active').length,
                    pendingLeases: leasesWithCustomerInfo.filter(lease => lease.status === 'Pending').length,
                    expiredLeases: leasesWithCustomerInfo.filter(lease => lease.status === 'Expired').length,
                    terminatedLeases: leasesWithCustomerInfo.filter(lease => lease.status === 'Terminated').length,
                    leasesWithDocuments: leasesWithCustomerInfo.filter(lease => lease.hasDocuments).length,
                    leasesWithEscalations: leasesWithCustomerInfo.filter(lease => lease.hasEscalations).length
                }
            }
        });

    } catch (err) {
        console.error('Error in get_lease_agreements:', {
            message: err.message,
            stack: err.stack,
            facilityId: request.params.facilityId
        });

        return reply.code(500).send({
            success: false,
            error: 'An error occurred while fetching lease agreements.',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

module.exports = get_lease_agreements;