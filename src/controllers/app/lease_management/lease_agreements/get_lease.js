const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_lease = async (request, reply) => {
    try {
        const { facilityId, leaseId } = request.params;

        if (!facilityId || !leaseId) {
            return reply.code(400).send({ 
                success: false,
                error: 'Missing required parameters.' 
            });
        }

        // Dynamically fetch facility-specific models
        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const leaseTemplateModel = await getModel('LeaseTemplate', payservedb.LeaseTemplate.schema, facilityId);
        const bankDetailsModel = await getModel('BankDetails', payservedb.BankDetails.schema, facilityId);

        // First get the lease agreement
        const leaseAgreement = await leaseAgreementModel.findById(leaseId)
            .populate({
                path: 'unitNumber',
                model: unitModel,
                select: 'name floorUnitNo'
            })
            .populate({
                path: 'leaseTemplate',
                model: leaseTemplateModel,
                select: 'name templateContent'
            })
            .populate({
                path: 'bankDetails',
                model: bankDetailsModel,
                select: 'accountName accountNumber bankName branchName isDefault'
            })
            .lean();

        if (!leaseAgreement) {
            return reply.code(404).send({ 
                success: false,
                error: 'Lease agreement not found.' 
            });
        }

        // Then fetch tenant and landlord from the main Customer model
        const tenant = await payservedb.Customer.findById(leaseAgreement.tenant)
            .select('firstName lastName phoneNumber email idNumber')
            .lean();

        const landlord = await payservedb.Customer.findById(leaseAgreement.landlord)
            .select('firstName lastName phoneNumber email')
            .lean();

        // Populate bank details for payment methods if they have bankDetailsId
        if (leaseAgreement.financialTerms?.paymentMethods) {
            for (const paymentMethod of leaseAgreement.financialTerms.paymentMethods) {
                if (paymentMethod.bankDetailsId) {
                    try {
                        const bankDetails = await bankDetailsModel.findById(paymentMethod.bankDetailsId)
                            .select('accountName accountNumber bankName branchName isDefault')
                            .lean();

                        if (bankDetails) {
                            paymentMethod.bankDetails = bankDetails;
                        }
                    } catch (bankError) {
                        console.error('Error populating bank details for payment method:', bankError);
                        // Continue without bank details if there's an error
                    }
                }
            }
        }

        // Process escalations information if present
        let escalationsInfo = null;
        if (leaseAgreement.financialTerms?.escalations && leaseAgreement.financialTerms.escalations.length > 0) {
            // Sort escalations by effectiveDate
            const sortedEscalations = [...leaseAgreement.financialTerms.escalations].sort(
                (a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate)
            );
            
            // Get next scheduled escalation
            const nextEscalation = sortedEscalations.find(e => e.status === 'scheduled');
            
            escalationsInfo = {
                count: leaseAgreement.financialTerms.escalations.length,
                hasScheduledEscalations: Boolean(nextEscalation),
                nextEscalation: nextEscalation ? {
                    id: nextEscalation._id,
                    date: nextEscalation.effectiveDate,
                    type: nextEscalation.type,
                    value: nextEscalation.value,
                    formattedValue: nextEscalation.type === 'percentage' 
                        ? `${nextEscalation.value}%` 
                        : `+${nextEscalation.value}`
                } : null
            };
        }

        // Combine all the data
        const populatedLeaseAgreement = {
            ...leaseAgreement,
            tenant,
            landlord,
            escalationsInfo,
            requiresLandlordApproval: Boolean(leaseAgreement.requireLandlordApproval)
        };

        // Return success response
        return reply.code(200).send({
            success: true,
            data: populatedLeaseAgreement
        });

    } catch (err) {
        console.error('Error in get_lease:', err.stack);
        return reply.code(500).send({ 
            success: false,
            error: 'An error occurred while fetching the lease agreement.' 
        });
    }
};

module.exports = get_lease;