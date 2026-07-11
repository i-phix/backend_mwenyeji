const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const terminate_lease_agreement = async (request, reply) => {
    try {
        const { facilityId, leaseId } = request.params;
        console.log(`Terminating lease ${leaseId} for facility ${facilityId}`);

        // Dynamically fetch models
        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);
        const handoverModel = await getModel('Handover', payservedb.Handover.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        const propertyManagerContractModel = await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId);

        // Find the lease agreement by ID
        const leaseAgreement = await leaseAgreementModel.findById(leaseId);
        
        if (!leaseAgreement) {
            return reply.code(404).send({ 
                success: false,
                error: `Lease Agreement with ID ${leaseId} does not exist.` 
            });
        }

        // Verify that the lease can be terminated
        if (leaseAgreement.status === 'Terminated') {
            return reply.code(400).send({ 
                success: false,
                error: 'This lease agreement is already terminated.' 
            });
        }

        // Get unit and tenant details
        const unit = await unitModel.findById(leaseAgreement.unitNumber);
        
        if (!unit) {
            console.warn(`Unit not found: ${leaseAgreement.unitNumber}`);
        }

        // Update the lease status to "Terminated"
        leaseAgreement.status = 'Terminated';
        await leaseAgreement.save();
        console.log(`Lease ${leaseId} status updated to Terminated`);

        // *** Handle Property Management Contract Updates ***
        let contractUpdateResults = [];
        try {
            // Find any property management contracts that include this unit
            const affectedContracts = await propertyManagerContractModel.find({
                units: leaseAgreement.unitNumber,
                facilityId: facilityId,
                status: { $in: ['Active', 'Inactive'] } // Don't update already terminated contracts
            });

            console.log(`Found ${affectedContracts.length} property management contracts affected by lease termination`);

            for (const contract of affectedContracts) {
                try {
                    // Clear lease-dependent fields that actually exist in the schema
                    const contractUpdateData = {
                        status: 'Inactive',
                        updatedBy: request.user ? request.user._id : null,
                        updatedAt: new Date(),
                        // Clear lease-dependent fields - ONLY fields that exist in schema
                        $unset: {
                            startDate: "",
                            endDate: "",
                            paymentDueDate: "", // Updated field name (was invoiceDay)
                            frequency: "", // Updated field name (was collectionFrequency)
                            autoSend: "",
                            balanceBroughtForward: "",
                            nextInvoiceDate: "",
                            lastInvoiceDate: "" // Also clear last invoice date
                        },
                        // Add edit history entry
                        $push: {
                            editHistory: {
                                editedBy: request.user ? request.user._id : 'System',
                                editedAt: new Date(),
                                reason: `Lease termination: Lease ${leaseId} was terminated, clearing lease-dependent fields`,
                                changes: {
                                    action: 'LEASE_TERMINATION_UPDATE',
                                    terminatedLeaseId: leaseId,
                                    previousStatus: contract.status,
                                    newStatus: 'Inactive',
                                    clearedFields: [
                                        'startDate', 
                                        'endDate', 
                                        'paymentDueDate', 
                                        'frequency', 
                                        'autoSend', 
                                        'balanceBroughtForward', 
                                        'nextInvoiceDate',
                                        'lastInvoiceDate'
                                    ]
                                }
                            }
                        }
                    };

                    const updatedContract = await propertyManagerContractModel.findByIdAndUpdate(
                        contract._id,
                        contractUpdateData,
                        { new: true }
                    );

                    contractUpdateResults.push({
                        contractId: contract._id,
                        contractName: contract.contractName,
                        previousStatus: contract.status,
                        newStatus: 'Inactive',
                        success: true
                    });

                    console.log(`Updated property management contract ${contract._id} due to lease termination`);

                } catch (contractError) {
                    console.error(`Error updating contract ${contract._id}:`, contractError);
                    contractUpdateResults.push({
                        contractId: contract._id,
                        contractName: contract.contractName,
                        success: false,
                        error: contractError.message
                    });
                }
            }

        } catch (contractError) {
            console.error('Error finding/updating property management contracts:', contractError);
            // Don't fail lease termination if contract update fails
        }

        // Find unpaid invoices for this tenant and unit
        let unpaidInvoices = [];
        let totalUnpaidAmount = 0;
        let invoiceDeductions = [];
        
        try {
            unpaidInvoices = await invoiceModel.find({
                'client.clientId': leaseAgreement.tenant,
                'unit.id': leaseAgreement.unitNumber,
                'status': { $in: ['Unpaid', 'Overdue', 'Partially Paid'] }
            });
            
            console.log(`Found ${unpaidInvoices.length} unpaid invoices for this tenant and unit`);
            
            // Calculate total unpaid amount and create deduction entries
            if (unpaidInvoices.length > 0) {
                for (const invoice of unpaidInvoices) {
                    const amountDue = invoice.totalAmount - (invoice.amountPaid || 0);
                    
                    if (amountDue > 0) {
                        totalUnpaidAmount += amountDue;
                        
                        invoiceDeductions.push({
                            reason: `Unpaid Invoice #${invoice.invoiceNumber}`,
                            amount: amountDue,
                            description: `Outstanding balance for invoice dated ${new Date(invoice.issueDate).toLocaleDateString()}. Items: ${invoice.items.map(item => item.description).join(', ')}`
                        });
                    }
                }
            }
        } catch (invoiceError) {
            console.warn('Error fetching unpaid invoices:', invoiceError.message);
            // Continue without invoice data
        }

        let moveOutHandover = null;
        let handoverCreated = false;

        try {
            // Look for an existing move-in handover for this unit and tenant
            const moveInHandover = await handoverModel.findOne({
                unitId: leaseAgreement.unitNumber,
                customerId: leaseAgreement.tenant,
                handoverType: 'MoveIn',
                status: { $in: ['Completed', 'Draft'] }
            }).sort({ handoverDate: -1 });

            console.log(`Found move-in handover: ${moveInHandover ? moveInHandover._id : 'None'}`);

            // Get customer from main database for better handover details
            const customer = await payservedb.Customer.findById(leaseAgreement.tenant);
            const customerName = customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer';
            const unitName = unit ? unit.name : 'Unknown Unit';

            // Get security deposit amount
            const depositAmount = leaseAgreement.financialTerms?.securityDeposit || 0;
            
            // Calculate refund amount after unpaid invoices
            const refundAmount = Math.max(0, depositAmount - totalUnpaidAmount);
            
            // Create deductions array with invoice deductions
            const deductions = [...invoiceDeductions];
            
            // Add note about unpaid invoices
            let unpaidInvoicesNote = '';
            if (unpaidInvoices.length > 0) {
                unpaidInvoicesNote = `
${unpaidInvoices.length} unpaid invoice(s) found with a total outstanding balance of ${totalUnpaidAmount.toFixed(2)}.
These have been automatically added as deductions from the security deposit.

`;
            }

            // Add note about property management contract updates
            let contractUpdateNote = '';
            if (contractUpdateResults.length > 0) {
                const successfulUpdates = contractUpdateResults.filter(r => r.success);
                const failedUpdates = contractUpdateResults.filter(r => !r.success);
                
                contractUpdateNote = `
PROPERTY MANAGEMENT CONTRACTS UPDATED:
${successfulUpdates.length > 0 ? `- ${successfulUpdates.length} contract(s) updated to Inactive status and lease-dependent fields cleared` : ''}
${failedUpdates.length > 0 ? `- ${failedUpdates.length} contract(s) failed to update` : ''}
${successfulUpdates.length > 0 ? `- Cleared fields: startDate, endDate, paymentDueDate, frequency, autoSend, balanceBroughtForward, nextInvoiceDate, lastInvoiceDate` : ''}

`;
            }

            // Create draft move-out handover with proper structure
            const moveOutHandoverData = {
                facilityId,
                unitId: leaseAgreement.unitNumber,
                customerId: leaseAgreement.tenant,
                relatedHandoverId: moveInHandover ? moveInHandover._id : null,
                handoverType: 'MoveOut',
                handoverDate: new Date(),
                status: 'Draft',
                items: moveInHandover ? JSON.parse(JSON.stringify(moveInHandover.items || [])) : [],
                meterReadings: {
                    electricity: { reading: 0 },
                    water: { reading: 0 },
                    gas: { reading: 0 }
                },
                securityDeposit: {
                    amount: depositAmount,
                    deductions: deductions,
                    refundAmount: refundAmount
                },
                notes: `AUTOMATIC MOVE-OUT HANDOVER: Created due to lease termination on ${new Date().toLocaleDateString()}.
                
This is an auto-generated draft handover created when lease #${leaseAgreement._id} was terminated.

${unpaidInvoicesNote}${contractUpdateNote}Please complete the handover process by:
1. Verifying inventory items and their condition
2. Recording meter readings
3. Adding any additional security deposit deductions if needed
4. Collecting signatures from relevant parties

Security deposit amount of ${depositAmount} has been automatically loaded from the lease agreement.
${unpaidInvoices.length > 0 ? `After accounting for unpaid invoices, the refund amount is ${refundAmount}.` : ''}

Lease Agreement: ${leaseAgreement._id}
Unit: ${unitName}
Tenant: ${customerName}`,
                keysHandedOver: 0,
                signatures: {
                    propertyManager: {},
                    customer: { agreement: false }
                },
                attachments: []
            };

            moveOutHandover = await handoverModel.create(moveOutHandoverData);
            handoverCreated = true;
            console.log(`Created move-out handover: ${moveOutHandover._id}`);

            // Return response with detailed handover information and contract updates
            return reply.code(200).send({
                success: true,
                message: 'Lease Agreement terminated successfully',
                data: {
                    leaseAgreement: {
                        _id: leaseAgreement._id,
                        status: leaseAgreement.status,
                        unitName: unitName,
                        unitId: leaseAgreement.unitNumber
                    },
                    handover: {
                        _id: moveOutHandover._id,
                        handoverId: moveOutHandover._id,
                        status: moveOutHandover.status,
                        handoverDate: moveOutHandover.handoverDate,
                        unitId: moveOutHandover.unitId,
                        unitName: unitName,
                        customerId: moveOutHandover.customerId,
                        tenantName: customerName
                    },
                    handoverDetails: {
                        securityDeposit: moveOutHandover.securityDeposit.amount,
                        itemCount: moveOutHandover.items.length,
                        unpaidInvoices: unpaidInvoices.length,
                        unpaidInvoicesAmount: totalUnpaidAmount,
                        refundAmount: refundAmount
                    },
                    propertyManagementUpdates: {
                        contractsFound: contractUpdateResults.length,
                        contractsUpdated: contractUpdateResults.filter(r => r.success).length,
                        contractsFailed: contractUpdateResults.filter(r => !r.success).length,
                        details: contractUpdateResults
                    }
                }
            });

        } catch (handoverError) {
            console.error('Error creating move-out handover:', handoverError);
            
            // Still return success for lease termination, but indicate handover creation failed
            return reply.code(200).send({
                success: true,
                message: 'Lease Agreement terminated successfully, but handover creation failed',
                error: handoverError.message,
                data: {
                    leaseAgreement: {
                        _id: leaseAgreement._id,
                        status: leaseAgreement.status
                    },
                    handoverCreated: false,
                    propertyManagementUpdates: {
                        contractsFound: contractUpdateResults.length,
                        contractsUpdated: contractUpdateResults.filter(r => r.success).length,
                        contractsFailed: contractUpdateResults.filter(r => !r.success).length,
                        details: contractUpdateResults
                    }
                }
            });
        }
    } catch (err) {
        console.error('Error in terminate_lease_agreement:', err);
        return reply.code(500).send({ 
            success: false,
            error: 'An error occurred while terminating the lease agreement.' 
        });
    }
};

module.exports = terminate_lease_agreement;