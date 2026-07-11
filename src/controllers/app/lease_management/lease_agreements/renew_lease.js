const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const renew_lease_agreement = async (request, reply) => {
    try {
        const { facilityId, leaseId } = request.params;
        
        // Log the incoming request for debugging
        console.log('Lease renewal request body:', JSON.stringify(request.body, null, 2));
        
        const {
            leaseTerms,
            financialTerms,
            billingCycle,
            status = 'Active',
            reminders = [],
            requireLandlordApproval = false, // Add support for landlord approval
            escalations = [] // Add support for lease escalations
        } = request.body;

        // Dynamically fetch models with facility context
        const models = {
            leaseAgreement: await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId),
            currency: await getModel('Currency', payservedb.Currency.schema, facilityId)
        };

        // Find existing lease agreement
        const existingLease = await models.leaseAgreement.findById(leaseId);
        if (!existingLease) {
            return reply.code(404).send({ 
                success: false,
                error: `Lease agreement with ID ${leaseId} not found.` 
            });
        }

        // Process escalations if provided
        const processedEscalations = [];
        if (Array.isArray(escalations) && escalations.length > 0) {
            for (const esc of escalations) {
                // Validate escalation data
                if (!esc.effectiveDate || !esc.type || !esc.value) {
                    console.warn('Skipping invalid escalation:', esc);
                    continue;
                }

                // Make sure type is valid
                if (!['percentage', 'fixed'].includes(esc.type)) {
                    console.warn(`Invalid escalation type: ${esc.type}`);
                    continue;
                }

                processedEscalations.push({
                    effectiveDate: new Date(esc.effectiveDate),
                    type: esc.type,
                    value: parseFloat(esc.value),
                    status: esc.status || 'scheduled'
                });
            }
        }

        // Prepare renewal data
        const renewalData = {
            // Keep existing references
            facilityId: existingLease.facilityId,
            unitNumber: existingLease.unitNumber,
            landlord: existingLease.landlord,
            tenant: existingLease.tenant,
            currency: existingLease.currency,
            leaseTemplate: existingLease.leaseTemplate,

            // Update lease terms
            leaseTerms: {
                startDate: new Date(leaseTerms.startDate),
                endDate: new Date(leaseTerms.endDate),
                duration: Number(leaseTerms.duration),
                autoRenewal: leaseTerms.autoRenewal || false
            },

            // Reset and update financial terms
            financialTerms: {
                ...existingLease.financialTerms,
                balanceBroughtForward: 0, // Reset balance
                monthlyRent: Number(financialTerms?.monthlyRent || existingLease.financialTerms.monthlyRent),
                paymentDueDate: Number(financialTerms?.paymentDueDate || existingLease.financialTerms.paymentDueDate),
                // Optionally update payment methods if provided
                paymentMethods: financialTerms?.paymentMethods || existingLease.financialTerms.paymentMethods
            },

            // Update billing cycle
            billingCycle: {
                frequency: billingCycle?.frequency || existingLease.billingCycle.frequency,
                nextInvoiceDate: billingCycle?.nextInvoiceDate 
                    ? new Date(billingCycle.nextInvoiceDate) 
                    : new Date(leaseTerms.startDate).setMonth(new Date(leaseTerms.startDate).getMonth() + 1),
                autoSend: billingCycle?.autoSend || existingLease.billingCycle.autoSend
            },

            // Set status to Active
            status: 'Active',

            // Add escalations if provided, otherwise keep existing ones
            requireLandlordApproval: Boolean(requireLandlordApproval),

            // Reset reminders
            reminders: reminders.length > 0 
                ? reminders.map(reminder => ({
                    reminderId: reminder.reminderId,
                    status: 'Pending'
                }))
                : [],

            // Reset lease documents
            leaseDocuments: []
        };

        // Add escalations to financial terms if any were provided
        if (processedEscalations.length > 0) {
            renewalData.financialTerms.escalations = processedEscalations;
        }

        // Create a new lease agreement as a renewal
        const renewedLeaseAgreement = await models.leaseAgreement.create(renewalData);

        // Populate response with detailed information
        const populatedRenewedLease = await models.leaseAgreement
            .findById(renewedLeaseAgreement._id)
            .populate({
                path: 'currency',
                model: models.currency,
                select: 'currencyName currencyShortCode'
            });

        // Optionally update the status of the original lease
        await models.leaseAgreement.findByIdAndUpdate(leaseId, { 
            status: 'Expired',
            // You might want to add more details about the renewal
            renewedBy: renewedLeaseAgreement._id 
        });

        return reply.code(201).send({
            success: true,
            message: 'Lease Agreement renewed successfully',
            data: populatedRenewedLease
        });

    } catch (error) {
        console.error('Error in renew_lease_agreement:', error);
        
        return reply.code(500).send({ 
            success: false,
            error: error.message || 'An unexpected error occurred while renewing the lease agreement.'
        });
    }
};

module.exports = renew_lease_agreement;