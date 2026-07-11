const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Specialized endpoint that returns ALL data needed for lease template population in a single call
 */
const get_lease_data_for_template = async (request, reply) => {
  try {
    const { facilityId, leaseId } = request.params;
    console.log(`[get_lease_data_for_template] Starting endpoint with facilityId: ${facilityId}, leaseId: ${leaseId}`);

    if (!mongoose.Types.ObjectId.isValid(facilityId) || !mongoose.Types.ObjectId.isValid(leaseId)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid facility ID or lease ID format'
      });
    }

    // Get necessary models
    const models = {
      leaseAgreement: await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId),
      unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
      currency: await getModel('Currency', payservedb.Currency.schema, facilityId),
      penalty: await getModel('Penalty', payservedb.Penalty.schema, facilityId),
      reminder: await getModel('Reminder', payservedb.Reminder.schema, facilityId),
      leaseTemplate: await getModel('LeaseTemplate', payservedb.LeaseTemplate.schema, facilityId)
    };

    // Get facility information
    const facility = await payservedb.Facility.findById(facilityId).lean();
    if (!facility) {
      return reply.code(404).send({
        success: false,
        error: `Facility with ID ${facilityId} not found.`
      });
    }

    // Get lease agreement with all necessary references populated
    const leaseAgreement = await models.leaseAgreement.findById(leaseId)
      .populate({
        path: 'unitNumber',
        model: models.unit,
        select: 'name floorUnitNo unitType division landRateNumber'
      })
      .populate({
        path: 'tenant',
        model: payservedb.Customer,
        select: 'firstName lastName phoneNumber email idNumber nextOfKinName nextOfKinRelationship nextOfKinContact familyMembers staff vehicles'
      })
      .populate({
        path: 'landlord',
        model: payservedb.Customer,
        select: 'firstName lastName phoneNumber email idNumber'
      })
      .populate({
        path: 'currency',
        model: models.currency,
        select: 'currencyName currencyShortCode'
      })
      .populate({
        path: 'leaseTemplate',
        model: models.leaseTemplate,
        select: 'name templateContent'
      })
      .populate({
        path: 'financialTerms.penaltyId',
        model: models.penalty,
        select: 'name type percentage amount effectDays'
      })
      .populate({
        path: 'reminders.reminderId',
        model: models.reminder,
        select: 'name notificationTypes'
      })
      .lean();

    if (!leaseAgreement) {
      return reply.code(404).send({
        success: false,
        error: `Lease agreement with ID ${leaseId} not found.`
      });
    }

    // Format date strings
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        return new Date(dateString).toLocaleDateString('en-US', {
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        });
      } catch (e) {
        return 'N/A';
      }
    };
    
    // Current date for signatures
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });

    // Format family members data
    let formattedFamilyMembers = 'None';
    if (leaseAgreement.tenant?.familyMembers?.length > 0) {
      const activeFamilyMembers = leaseAgreement.tenant.familyMembers.filter(m => !m.disabled);
      if (activeFamilyMembers.length > 0) {
        formattedFamilyMembers = activeFamilyMembers
          .map(member => `${member.name || 'N/A'} (${member.relation || 'N/A'}) - ${member.phoneNumber || 'N/A'}`)
          .join('\n');
      }
    }

    // Format staff data
    let formattedStaff = 'None';
    if (leaseAgreement.tenant?.staff?.length > 0) {
      const activeStaff = leaseAgreement.tenant.staff.filter(m => !m.disabled);
      if (activeStaff.length > 0) {
        formattedStaff = activeStaff
          .map(staff => `${staff.name || 'N/A'} (${staff.jobRole || 'N/A'}) - ${staff.phoneNumber || 'N/A'}`)
          .join('\n');
      }
    }

    // Format vehicles data
    let formattedVehicles = 'None';
    if (leaseAgreement.tenant?.vehicles?.length > 0) {
      const activeVehicles = leaseAgreement.tenant.vehicles.filter(v => !v.disabled);
      if (activeVehicles.length > 0) {
        formattedVehicles = activeVehicles
          .map(vehicle => `${vehicle.name || 'N/A'} - ${vehicle.model || 'N/A'} - ${vehicle.plateNumber || 'N/A'} (${vehicle.color || 'N/A'})`)
          .join('\n');
      }
    }

    // Calculate deposit months if not explicitly available
    let depositMonths = leaseAgreement.financialTerms?.depositMonths?.toString() || 'N/A';

    // If deposit months is not available but we have security deposit and monthly rent
    if (depositMonths === 'N/A' && 
        leaseAgreement.financialTerms?.securityDeposit && 
        leaseAgreement.financialTerms?.monthlyRent && 
        leaseAgreement.financialTerms.monthlyRent > 0) {
        
        // Calculate by dividing security deposit by monthly rent
        const calculatedMonths = Math.round(
            leaseAgreement.financialTerms.securityDeposit / 
            leaseAgreement.financialTerms.monthlyRent
        );
        
        // Use the calculated value if it makes sense (between 1-12 months)
        if (calculatedMonths >= 1 && calculatedMonths <= 12) {
            depositMonths = calculatedMonths.toString();
            console.log(`[get_lease_data_for_template] Calculated deposit months: ${depositMonths}`);
        }
    }

    // Format payment methods - ensure details are properly structured for template
    let formattedPaymentMethods = 'None';
    let paymentMethods = [];
    let primaryPaymentMethod = null;
    
    if (leaseAgreement.financialTerms?.paymentMethods?.length > 0) {
      // Create simple list of payment method types (instead of verbose format)
      formattedPaymentMethods = leaseAgreement.financialTerms.paymentMethods
        .map(method => method.type)
        .join(', ');
      
      // Create structured payment method objects for the template
      paymentMethods = leaseAgreement.financialTerms.paymentMethods.map(method => {
        // Ensure details object exists with all properties
        const details = method.details || {};
        
        // Make a complete details object that has all possible fields
        const completeDetails = {
          bankName: details.bankName || 'N/A',
          accountName: details.accountName || 'N/A',
          accountNumber: details.accountNumber || 'N/A',
          branch: details.branch || 'N/A',
          swiftCode: details.swiftCode || 'N/A',
          preferredCashLocation: details.preferredCashLocation || 'N/A',
          bankToDraft: details.bankToDraft || 'N/A',
          chequeAccountNumber: details.chequeAccountNumber || 'N/A',
          provider: details.provider || 'N/A',
          phoneNumber: details.phoneNumber || 'N/A'
        };
        
        return {
          type: method.type || 'N/A',
          isPrimary: method.isPrimary ? 'Yes' : 'No',
          details: completeDetails
        };
      });
      
      // Find primary payment method or use first one
      primaryPaymentMethod = paymentMethods.find(m => m.isPrimary === 'Yes') || paymentMethods[0];
    } else {
      // Default primary payment method with empty details
      primaryPaymentMethod = {
        type: 'N/A',
        isPrimary: 'No',
        details: {
          bankName: 'N/A',
          accountName: 'N/A',
          accountNumber: 'N/A',
          branch: 'N/A',
          swiftCode: 'N/A',
          preferredCashLocation: 'N/A',
          bankToDraft: 'N/A',
          chequeAccountNumber: 'N/A',
          provider: 'N/A',
          phoneNumber: 'N/A'
        }
      };
    }

    // Get penalty details
    let penalty = {
      name: 'N/A',
      type: 'N/A',
      amount: 'N/A',
      percentage: 'N/A'
    };
    
    if (leaseAgreement.financialTerms?.penaltyId) {
      const penaltyData = leaseAgreement.financialTerms.penaltyId;
      penalty = {
        name: penaltyData.name || 'N/A',
        type: penaltyData.type || 'N/A',
        amount: penaltyData.type === 'fixed' ? (penaltyData.amount?.toLocaleString() || 'N/A') : 'N/A',
        percentage: penaltyData.type === 'percentage' ? (penaltyData.percentage || 'N/A') : 'N/A'
      };
    }

    // Get reminder details
    let reminder = {
      name: 'N/A',
      notificationTypes: 'N/A'
    };
    
    if (leaseAgreement.reminders?.length > 0 && leaseAgreement.reminders[0].reminderId) {
      const reminderData = leaseAgreement.reminders[0].reminderId;
      reminder = {
        name: reminderData.name || 'N/A',
        notificationTypes: Array.isArray(reminderData.notificationTypes) ? 
          reminderData.notificationTypes.join(', ') : 'N/A'
      };
    }

    // Prepare all template data in one structured object
    const templateData = {
      tenant: {
        firstName: leaseAgreement.tenant?.firstName || 'N/A',
        lastName: leaseAgreement.tenant?.lastName || 'N/A',
        phoneNumber: leaseAgreement.tenant?.phoneNumber || 'N/A',
        email: leaseAgreement.tenant?.email || 'N/A',
        idNumber: leaseAgreement.tenant?.idNumber || 'N/A',
        nextOfKinName: leaseAgreement.tenant?.nextOfKinName || 'N/A',
        nextOfKinRelationship: leaseAgreement.tenant?.nextOfKinRelationship || 'N/A',
        nextOfKinContact: leaseAgreement.tenant?.nextOfKinContact || 'N/A',
        familyMembers: formattedFamilyMembers,
        staff: formattedStaff,
        vehicles: formattedVehicles
      },
      landlord: {
        firstName: leaseAgreement.landlord?.firstName || 'N/A',
        lastName: leaseAgreement.landlord?.lastName || 'N/A',
        phoneNumber: leaseAgreement.landlord?.phoneNumber || 'N/A',
        email: leaseAgreement.landlord?.email || 'N/A',
        idNumber: leaseAgreement.landlord?.idNumber || 'N/A'
      },
      unit: {
        name: leaseAgreement.unitNumber?.name || 'N/A',
        floorUnitNo: leaseAgreement.unitNumber?.floorUnitNo || 'N/A',
        unitType: leaseAgreement.unitNumber?.unitType || 'N/A',
        division: leaseAgreement.unitNumber?.division || 'N/A',
        landRateNumber: leaseAgreement.unitNumber?.landRateNumber || 'N/A'
      },
      property: {
        address: `${facility.name}, ${facility.location}` || 'N/A',
        landReferenceNumber: facility.landReferenceNumbers?.length > 0 ? 
          facility.landReferenceNumbers[0] : 'N/A'
      },
      currency: {
        currencyName: leaseAgreement.currency?.currencyName || 'N/A',
        currencyShortCode: leaseAgreement.currency?.currencyShortCode || 'N/A'
      },
      lease: {
        status: leaseAgreement.status || 'N/A',
        leaseTerms: {
          startDate: formatDate(leaseAgreement.leaseTerms?.startDate),
          endDate: formatDate(leaseAgreement.leaseTerms?.endDate),
          duration: leaseAgreement.leaseTerms?.duration?.toString() || 'N/A',
          autoRenewal: leaseAgreement.leaseTerms?.autoRenewal ? 'Yes' : 'No'
        },
        financialTerms: {
          monthlyRent: leaseAgreement.financialTerms?.monthlyRent?.toLocaleString() || 'N/A',
          securityDeposit: leaseAgreement.financialTerms?.securityDeposit?.toLocaleString() || 'N/A',
          depositMonths: depositMonths,
          balanceBroughtForward: leaseAgreement.financialTerms?.balanceBroughtForward?.toLocaleString() || '0',
          paymentDueDate: leaseAgreement.financialTerms?.paymentDueDate?.toString() || 'N/A',
          // Payment method information
          paymentMethods: paymentMethods,
          paymentMethodsFormatted: formattedPaymentMethods,
          // Primary payment method
          primaryPaymentMethod: primaryPaymentMethod,
          // M-Pesa information
          mpesaEnabled: leaseAgreement.financialTerms?.mpesaEnabled ? 'Yes' : 'No',
          mpesaDetails: leaseAgreement.financialTerms?.mpesaDetails || {
            businessNumber: 'N/A',
            accountNumber: 'N/A',
            phoneNumber: 'N/A'
          }
        },
        billingCycle: {
          frequency: leaseAgreement.billingCycle?.frequency || 'N/A',
          nextInvoiceDate: formatDate(leaseAgreement.billingCycle?.nextInvoiceDate),
          autoSend: leaseAgreement.billingCycle?.autoSend ? 'Yes' : 'No'
        }
      },
      penalty: penalty,
      reminder: reminder,
      signatures: {
        currentDate: currentDate,
        tenant: '_______________________',
        landlord: '_______________________',
        tenantWitness: '_______________________',
        landlordWitness: '_______________________'
      },
      templateContent: leaseAgreement.leaseTemplate?.templateContent || ''
    };

    // Debug logs for key data
    console.log('[get_lease_data_for_template] Payment methods:', paymentMethods[0]?.details || 'No payment methods');
    console.log('[get_lease_data_for_template] Deposit months:', depositMonths);

    return reply.code(200).send({
      success: true,
      data: templateData
    });
  } catch (err) {
    console.error('[get_lease_data_for_template] Error:', err);
    return reply.code(500).send({
      success: false,
      error: err.message || 'An unexpected error occurred while fetching lease template data.'
    });
  }
};

module.exports = get_lease_data_for_template;