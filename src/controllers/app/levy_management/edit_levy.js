// controllers/app/levy_management/edit_levy.js
const payservedb = require('payservedb');
const mongoose = require('mongoose');
const { getModel } = require('../../../utils/getModel');
const ObjectId = mongoose.Types.ObjectId;

const validateGLAccounts = async (glAccounts, facilityId, glAccountModel) => {
  if (!glAccounts) {
    throw new Error('GL accounts configuration is required');
  }

  // Check that all required GL account fields are provided
  if (!glAccounts.invoice?.debit || !glAccounts.invoice?.credit ||
      !glAccounts.payment?.debit || !glAccounts.payment?.credit) {
    throw new Error('All GL account fields (invoice debit/credit, payment debit/credit) are required');
  }

  // Collect all GL account IDs
  const glAccountIds = [
    glAccounts.invoice.debit,
    glAccounts.invoice.credit,
    glAccounts.payment.debit,
    glAccounts.payment.credit
  ];

  // Convert string IDs to ObjectIds if needed
  const objectIdAccountIds = glAccountIds.map(id => {
    try {
      return typeof id === 'string' ? new ObjectId(id) : id;
    } catch (err) {
      console.error(`Invalid ObjectId format for: ${id}`, err);
      throw new Error(`Invalid GL account ID format: ${id}`);
    }
  });

  // Get unique IDs to check (since the same account might be used in multiple positions)
  const uniqueAccountIds = [...new Set(objectIdAccountIds.map(id => id.toString()))].map(id => new ObjectId(id));

  console.log('Validating GL accounts with IDs:', objectIdAccountIds);

  // Verify that the GL accounts exist in this facility
  const existingGLAccounts = await glAccountModel.find({
    _id: { $in: uniqueAccountIds },
    facilityId: facilityId
  });

  console.log(`Found ${existingGLAccounts.length} out of ${uniqueAccountIds.length} unique GL accounts`);

  // Check if all of the unique accounts were found
  if (existingGLAccounts.length !== uniqueAccountIds.length) {
    // Find which accounts are missing
    const existingIds = existingGLAccounts.map(account => account._id.toString());
    const missingIds = uniqueAccountIds.map(id => id.toString()).filter(id => !existingIds.includes(id));

    console.error('Missing GL accounts:', missingIds);
    throw new Error(`One or more referenced GL accounts do not exist in this facility: ${missingIds.join(', ')}`);
  }

  return true;
};

const validateBankDetails = (bankPayment, bankDetails) => {
  if (!bankPayment) return true; // No validation needed if bank payment is disabled

  if (!bankDetails) {
    throw new Error('Bank details are required when bank payment is enabled');
  }

  // Required bank fields
  const requiredFields = ['bankName', 'accountName', 'accountNumber', 'branch'];
  const missingFields = [];

  requiredFields.forEach(field => {
    if (!bankDetails[field] || bankDetails[field].trim() === '') {
      missingFields.push(field.replace(/([A-Z])/g, ' $1').toLowerCase().trim());
    }
  });

  if (missingFields.length > 0) {
    throw new Error(`Required bank details missing: ${missingFields.join(', ')}`);
  }

  return true;
};

const edit_levy = async (request, reply) => {
  try {
    const { facilityId, levyId } = request.params;
    const {
      levyName,
      levyType,
      amount,
      dueDate,
      levyApplicant,
      collectionFrequency,
      invoiceDay,
      billingType,
      // Payment fields
      currency,
      mobilePayment,
      paymentMethodId,
      bankPayment,
      bankAccountId,
      billerAddressId,
      // GL Account fields (moved from contract to levy)
      glAccounts,
      reminder,
      penalty,
      reminderId,
      penaltyId,
      updateContractAmounts = true // Optional flag to control contract updates
    } = request.body;

    console.log('Edit levy request body:', JSON.stringify(request.body, null, 2));

    // Get the required models using getModel - Get all models upfront to ensure proper registration
    const [
      levyModel,
      reminderModel,
      penaltyModel,
      levyContractModel,
      glAccountModel,
      bankDetailsModel,
      billerAddressModel,
      currencyModel
    ] = await Promise.all([
      getModel('Levy', payservedb.Levy.schema, facilityId),
      getModel('Reminder', payservedb.Reminder.schema, facilityId),
      getModel('Penalty', payservedb.Penalty.schema, facilityId),
      getModel('LevyContract', payservedb.LevyContract.schema, facilityId),
      getModel('GLAccount', payservedb.GLAccount.schema, facilityId),
      getModel('BankDetails', payservedb.BankDetails.schema, facilityId),
      getModel('BillerAddress', payservedb.BillerAddress.schema, facilityId),
      getModel('Currency', payservedb.Currency.schema, facilityId)
    ]);

    // Find existing levy
    const existingLevy = await levyModel.findById(levyId);
    if (!existingLevy) {
      return reply.code(404).send({
        success: false,
        message: 'Levy not found'
      });
    }

    // Validate required fields
    if (levyName && levyName.trim().length === 0) {
      return reply.code(400).send({
        success: false,
        error: 'Levy name cannot be empty'
      });
    }

    if (amount && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
      return reply.code(400).send({
        success: false,
        error: 'Amount must be a positive number'
      });
    }

    // Validate billing type if provided
    if (billingType && !['Prepaid', 'Postpaid'].includes(billingType)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid billing type. Must be either Prepaid or Postpaid'
      });
    }

    // Validate currency if provided
    if (currency) {
      const currencyExists = await currencyModel.findById(currency);
      if (!currencyExists) {
        return reply.code(400).send({
          success: false,
          error: 'Selected currency does not exist or does not belong to this facility'
        });
      }
    }

    // Validate bank account if bank payment is enabled
    if (bankPayment && bankAccountId) {
      const bankAccount = await bankDetailsModel.findOne({
        _id: bankAccountId,
        facilityId: facilityId
      });

      if (!bankAccount) {
        return reply.code(400).send({
          success: false,
          error: 'Selected bank account does not exist or does not belong to this facility'
        });
      }
    }

    // Validate biller address if provided
    if (billerAddressId) {
      const billerAddress = await billerAddressModel.findOne({
        _id: billerAddressId,
        facilityId: facilityId
      });

      if (!billerAddress) {
        return reply.code(400).send({
          success: false,
          error: 'Selected biller address does not exist or does not belong to this facility'
        });
      }
    }

    // Validate GL accounts if provided
    if (glAccounts) {
      if (!glAccounts.invoice?.debit || !glAccounts.invoice?.credit ||
          !glAccounts.payment?.debit || !glAccounts.payment?.credit) {
        return reply.code(400).send({
          success: false,
          error: 'All GL account fields (invoice debit/credit, payment debit/credit) are required'
        });
      }

      // Collect all GL account IDs
      const glAccountIds = [
        glAccounts.invoice.debit,
        glAccounts.invoice.credit,
        glAccounts.payment.debit,
        glAccounts.payment.credit
      ];

      // Convert string IDs to ObjectIds if needed
      const objectIdAccountIds = glAccountIds.map(id => {
        try {
          return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
        } catch (err) {
          console.error(`Invalid ObjectId format for: ${id}`, err);
          throw new Error(`Invalid GL account ID format: ${id}`);
        }
      });

      // Get unique IDs to check
      const uniqueAccountIds = [...new Set(objectIdAccountIds.map(id => id.toString()))].map(id => new mongoose.Types.ObjectId(id));

      // Verify that the GL accounts exist in this facility
      const existingGLAccounts = await glAccountModel.find({
        _id: { $in: uniqueAccountIds },
        facilityId: facilityId
      });

      if (existingGLAccounts.length !== uniqueAccountIds.length) {
        const existingIds = existingGLAccounts.map(account => account._id.toString());
        const missingIds = uniqueAccountIds.map(id => id.toString()).filter(id => !existingIds.includes(id));

        return reply.code(400).send({
          success: false,
          error: `One or more referenced GL accounts do not exist in this facility: ${missingIds.join(', ')}`
        });
      }
    }

    // Enhanced debugging for amount comparison
    console.log('=== AMOUNT COMPARISON DEBUG ===');
    console.log('Incoming amount:', amount, typeof amount);
    console.log('Existing amount:', existingLevy.amount, typeof existingLevy.amount);
    console.log('Parsed incoming amount:', parseFloat(amount));
    console.log('Parsed existing amount:', parseFloat(existingLevy.amount));
    console.log('updateContractAmounts flag:', updateContractAmounts);

    // Check if amount is being changed - more robust comparison
    let isAmountChanged = false;
    let shouldUpdateContracts = false;

    if (amount !== undefined && amount !== null) {
      const newAmount = parseFloat(amount);
      const oldAmount = parseFloat(existingLevy.amount);
      isAmountChanged = !isNaN(newAmount) && !isNaN(oldAmount) && newAmount !== oldAmount;

      // Update contracts if amount changed and flag is true
      shouldUpdateContracts = isAmountChanged && updateContractAmounts;

      console.log('Amount changed?', isAmountChanged);
      console.log('Should update contracts?', shouldUpdateContracts);
    }

    // Prepare update object
    const updateData = {};
    
    if (levyName) updateData.levyName = levyName.trim();
    if (levyType) updateData.levyType = levyType;
    if (amount) updateData.amount = parseFloat(amount);
    if (dueDate) updateData.dueDate = dueDate;
    if (levyApplicant) updateData.levyApplicant = levyApplicant;
    if (collectionFrequency) updateData.collectionFrequency = collectionFrequency;
    if (invoiceDay) updateData.invoiceDay = invoiceDay;
    if (billingType) updateData.billingType = billingType;
    
    // Payment settings
    if (currency) updateData.currency = currency;
    if (mobilePayment !== undefined) updateData.mobilePayment = mobilePayment;
    if (mobilePayment && paymentMethodId) updateData.paymentMethodId = paymentMethodId;
    if (!mobilePayment) updateData.paymentMethodId = null;
    if (bankPayment !== undefined) updateData.bankPayment = bankPayment;
    if (bankPayment && bankAccountId) updateData.bankAccountId = bankAccountId;
    if (!bankPayment) updateData.bankAccountId = null;
    if (billerAddressId) updateData.billerAddressId = billerAddressId;
    
    // GL Accounts (moved from contract to levy)
    if (glAccounts) {
      updateData.glAccounts = {
        invoice: {
          debit: typeof glAccounts.invoice.debit === 'string' ? 
            new mongoose.Types.ObjectId(glAccounts.invoice.debit) : glAccounts.invoice.debit,
          credit: typeof glAccounts.invoice.credit === 'string' ? 
            new mongoose.Types.ObjectId(glAccounts.invoice.credit) : glAccounts.invoice.credit
        },
        payment: {
          debit: typeof glAccounts.payment.debit === 'string' ? 
            new mongoose.Types.ObjectId(glAccounts.payment.debit) : glAccounts.payment.debit,
          credit: typeof glAccounts.payment.credit === 'string' ? 
            new mongoose.Types.ObjectId(glAccounts.payment.credit) : glAccounts.payment.credit
        }
      };
    }

    // Update levy first
    const updatedLevy = await levyModel.findByIdAndUpdate(
      levyId,
      updateData,
      { new: true }
    );

    // Update associated levy contracts if amount changed and flag is true
    let updatedContractsCount = 0;
    if (shouldUpdateContracts) {
      console.log(`Levy amount changed from ${existingLevy.amount} to ${amount}. Updating associated contracts...`);

      // Convert levyId to ObjectId for proper comparison
      const levyObjectId = new mongoose.Types.ObjectId(levyId);

      // Find all contracts associated with this levy - with debugging
      console.log('Searching for contracts with levyId:', levyId, typeof levyId);
      console.log('Converted to ObjectId:', levyObjectId);
      
      const associatedContracts = await levyContractModel.find({ levyId: levyObjectId });
      console.log('Found contracts:', associatedContracts.length);

      if (associatedContracts.length > 0) {
        console.log('Contract IDs found:', associatedContracts.map(c => c._id));

        // Update all associated contracts with the new amount
        const contractUpdateResult = await levyContractModel.updateMany(
          { levyId: levyObjectId },
          {
            amount: parseFloat(amount),
            updatedAt: new Date()
          }
        );

        updatedContractsCount = contractUpdateResult.modifiedCount;
        console.log('Update result:', contractUpdateResult);
        console.log(`Updated ${updatedContractsCount} levy contracts with new amount: ${amount}`);

        // Verify the updates were applied
        const updatedContracts = await levyContractModel.find({ levyId: levyObjectId });
        console.log('Contracts after update:', updatedContracts.map(c => ({ id: c._id, amount: c.amount })));
      } else {
        console.log('No associated contracts found for levyId:', levyId);
      }
    } else {
      console.log('Skipping contract updates - isAmountChanged:', isAmountChanged, 'updateContractAmounts:', updateContractAmounts, 'shouldUpdateContracts:', shouldUpdateContracts);
    }

    // Handle reminder
    let updatedReminder = null;
    if (reminder) {
      if (reminderId) {
        // Update existing reminder
        updatedReminder = await reminderModel.findByIdAndUpdate(
          reminderId,
          {
            ...reminder,
            moduleId: levyId // Link to levy
          },
          { new: true }
        );
      } else {
        // Create new reminder
        updatedReminder = await reminderModel.create({
          ...reminder,
          moduleId: levyId, // Link to levy
          facilityId: facilityId
        });
        
        // Link the new reminder to the levy
        await levyModel.findByIdAndUpdate(levyId, {
          reminderId: updatedReminder._id
        });
      }
    }

    // Handle penalty
    let updatedPenalty = null;
    if (penalty && penalty.category) { // Only process if penalty has a category
      if (penaltyId) {
        // Update existing penalty
        updatedPenalty = await penaltyModel.findByIdAndUpdate(
          penaltyId,
          {
            name: penalty.name,
            category: penalty.category,
            type: penalty.type,
            enforcementType: penalty.enforcementType,
            effectDays: penalty.effectDays,
            percentage: penalty.type === 'percentage' ? penalty.percentage : null,
            amount: penalty.type === 'fixed' ? penalty.amount : null,
            moduleId: levyId,
            isActive: penalty.isActive
          },
          { new: true }
        );
      } else {
        // Create new penalty
        updatedPenalty = await penaltyModel.create({
          ...penalty,
          moduleId: levyId, // Link to levy
          facilityId: facilityId
        });
        
        // Link the new penalty to the levy
        await levyModel.findByIdAndUpdate(levyId, {
          penaltyId: updatedPenalty._id
        });
      }
    }

    // Get the fully updated levy for response
    const finalLevy = await levyModel.findById(levyId);

    // Prepare response message
    let message = 'Levy updated successfully';
    if (shouldUpdateContracts && updatedContractsCount > 0) {
      message += `. ${updatedContractsCount} associated contract(s) updated with new amount.`;
    }

    return reply.code(200).send({
      success: true,
      message: message,
      data: {
        levy: finalLevy,
        reminder: updatedReminder,
        penalty: updatedPenalty,
        contractsUpdated: updatedContractsCount
      }
    });

  } catch (err) {
    console.error('Error in editLevy:', err);
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(error => error.message);
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Handle cast errors (invalid ObjectId)
    if (err.name === 'CastError') {
      return reply.code(400).send({
        success: false,
        error: `Invalid ID format for field: ${err.path}`
      });
    }

    // Handle model registration errors
    if (err.name === 'MissingSchemaError') {
      return reply.code(500).send({
        success: false,
        error: 'Internal server error: Schema registration issue',
        details: 'Please contact system administrator'
      });
    }

    return reply.code(400).send({
      success: false,
      error: err.message || 'Failed to update levy'
    });
  }
};

module.exports = edit_levy;