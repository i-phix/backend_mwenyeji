 const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const createReminderRecord = async (reminderData, levyId, facilityId, reminderModel) => {
  if (!reminderData) return null;

  return await reminderModel.create({
    name: `${reminderData.name || 'Levy'} Reminder`,
    type: reminderData.type || 'standard',
    module: 'levy',
    moduleId: levyId,
    remindOn: {
      invoiceDate: reminderData.remindOn?.invoiceDate ?? true,
      dueDate: reminderData.remindOn?.dueDate ?? false,
      afterOverdue: {
        enabled: reminderData.remindOn?.afterOverdue?.enabled ?? false,
        daily: reminderData.remindOn?.afterOverdue?.daily ?? false, 
        days: reminderData.remindOn?.afterOverdue?.days ?? []
      }
    },
    time: reminderData.time || '09:00',
    notificationTypes: reminderData.notificationTypes || ['SMS', 'EMAIL'],
    message: reminderData.message || '',
    facilityId,
    timezone: reminderData.timezone || "UTC",
    isActive: true
  });
};

const createPenaltyRecord = async (penaltyData, levyId, facilityId, penaltyModel) => {
  if (!penaltyData || !penaltyData.category) return null;

  // Validate penalty data before creation
  if (!penaltyData.name || penaltyData.name.trim().length === 0) {
    throw new Error('Penalty name is required');
  }

  if (!penaltyData.effectDays || isNaN(parseInt(penaltyData.effectDays)) || parseInt(penaltyData.effectDays) < 1) {
    throw new Error('Effect days must be at least 1');
  }

  // Validate financial penalty fields
  if (['financial', 'both'].includes(penaltyData.category)) {
    if (!penaltyData.type) {
      throw new Error('Penalty type is required for financial penalties');
    }

    if (penaltyData.type === 'fixed') {
      if (!penaltyData.amount || isNaN(parseFloat(penaltyData.amount)) || parseFloat(penaltyData.amount) <= 0) {
        throw new Error('Valid penalty amount is required for fixed penalty type');
      }
    }

    if (penaltyData.type === 'percentage') {
      if (!penaltyData.percentage || isNaN(parseFloat(penaltyData.percentage)) || 
          parseFloat(penaltyData.percentage) <= 0 || parseFloat(penaltyData.percentage) > 100) {
        throw new Error('Penalty percentage must be between 1 and 100');
      }
    }
  }

  // Validate enforcement penalty fields
  if (['enforcement', 'both'].includes(penaltyData.category) && !penaltyData.enforcementType) {
    throw new Error('Enforcement type is required for enforcement penalties');
  }

  return await penaltyModel.create({
    name: penaltyData.name.trim(),
    category: penaltyData.category,
    type: penaltyData.type,
    enforcementType: penaltyData.enforcementType,
    effectDays: parseInt(penaltyData.effectDays),
    percentage: penaltyData.type === 'percentage' ? parseFloat(penaltyData.percentage) : null,
    amount: penaltyData.type === 'fixed' ? parseFloat(penaltyData.amount) : null,
    module: 'levy',
    moduleId: levyId,
    facilityId,
    isActive: penaltyData.isActive ?? true
  });
};

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
  console.log('Unique account IDs to check:', uniqueAccountIds);

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

const validateBankAccount = async (bankPayment, bankAccountId, facilityId, bankDetailsModel) => {
  if (!bankPayment) return null; // No validation needed if bank payment is disabled

  if (!bankAccountId) {
    throw new Error('Bank account is required when bank payment is enabled');
  }

  // Verify bank account exists and belongs to this facility
  const bankAccount = await bankDetailsModel.findOne({
    _id: bankAccountId,
    facilityId: facilityId
  });

  if (!bankAccount) {
    throw new Error('Selected bank account does not exist or does not belong to this facility');
  }

  return bankAccount;
};

const validateBillerAddress = async (billerAddressId, facilityId, billerAddressModel) => {
  if (!billerAddressId) {
    throw new Error('Biller address is required');
  }

  // Verify biller address exists and belongs to this facility
  const billerAddress = await billerAddressModel.findOne({
    _id: billerAddressId,
    facilityId: facilityId
  });

  if (!billerAddress) {
    throw new Error('Selected biller address does not exist or does not belong to this facility');
  }

  return billerAddress;
};

const validateCurrency = async (currencyId, facilityId, currencyModel) => {
  if (!currencyId) {
    throw new Error('Currency is required');
  }

  // Verify currency exists and belongs to this facility
  const currency = await currencyModel.findOne({
    _id: currencyId,
    facilityId: facilityId
  });

  if (!currency) {
    throw new Error('Selected currency does not exist or does not belong to this facility');
  }

  return currency;
};

const validateLevyType = async (levyTypeId, facilityId, levyTypeModel) => {
  if (!levyTypeId) {
    throw new Error('Levy type is required');
  }

  // Convert string to ObjectId if needed
  const objectId = typeof levyTypeId === 'string' ? new ObjectId(levyTypeId) : levyTypeId;

  // Verify levy type exists and belongs to this facility
  const levyType = await levyTypeModel.findOne({
    _id: objectId,
    facilityId: facilityId
  });

  if (!levyType) {
    throw new Error('Selected levy type does not exist or does not belong to this facility');
  }

  return levyType;
};

const validatePaymentMethod = async (mobilePayment, paymentMethodId, facilityId) => {
  if (!mobilePayment) return null; // No validation needed if mobile payment is disabled

  if (!paymentMethodId) {
    throw new Error('Payment method is required when mobile payment is enabled');
  }

  // You can add additional validation here to check if the payment method exists
  // For now, we'll just return the ID
  return paymentMethodId;
};

const addLevy = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      levyName,
      levyType,
      amount,
      levyApplicant,
      collectionFrequency,
      invoiceDay,
      dueDate,
      billingType,
      // Payment fields
      currency,
      mobilePayment,
      paymentMethodId,
      bankPayment,
      bankAccountId,
      billerAddressId,
      // GL Account fields
      glAccounts,
      reminder,
      penalty
    } = request.body;

    console.log('Request body received:', JSON.stringify(request.body, null, 2));

    // Get required models - IMPORTANT: Get LevyType model first
    const levyTypeModel = await getModel("LevyType", payservedb.LevyType.schema, facilityId);
    const levyModel = await getModel("Levy", payservedb.Levy.schema, facilityId);
    const reminderModel = await getModel("Reminder", payservedb.Reminder.schema, facilityId);
    const penaltyModel = await getModel("Penalty", payservedb.Penalty.schema, facilityId);
    const glAccountModel = await getModel("GLAccount", payservedb.GLAccount.schema, facilityId);
    const bankDetailsModel = await getModel("BankDetails", payservedb.BankDetails.schema, facilityId);
    const billerAddressModel = await getModel("BillerAddress", payservedb.BillerAddress.schema, facilityId);
    const currencyModel = await getModel("Currency", payservedb.Currency.schema, facilityId);

    // Validate required fields
    if (!levyName || levyName.trim().length === 0) {
      return reply.code(400).send({
        success: false,
        error: 'Levy name is required and cannot be empty'
      });
    }

    if (!levyType || !amount || !levyApplicant || 
        !collectionFrequency || !invoiceDay || !dueDate || !billingType) {
      return reply.code(400).send({
        success: false,
        error: 'Required fields missing. Please ensure all required fields are filled.'
      });
    }

    // Validate amount
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return reply.code(400).send({
        success: false,
        error: 'Amount must be a positive number'
      });
    }

    // Validate billing type
    if (!['Prepaid', 'Postpaid'].includes(billingType)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid billing type. Must be either Prepaid or Postpaid'
      });
    }

    // Check for duplicate levy name in the same facility
    const existingLevy = await levyModel.findOne({
      levyName: { $regex: new RegExp(`^${levyName.trim()}$`, 'i') }, // Case-insensitive check
      facilityId: facilityId,
      disabled: false // Only check active levies
    });

    if (existingLevy) {
      return reply.code(400).send({
        success: false,
        error: `A levy with the name "${levyName}" already exists in this facility. Please choose a different name.`
      });
    }

    // Validate levy type (required reference)
    let validatedLevyType = null;
    try {
      validatedLevyType = await validateLevyType(levyType, facilityId, levyTypeModel);
    } catch (err) {
      return reply.code(400).send({
        success: false,
        error: err.message
      });
    }

    // Validate currency (required)
    let validatedCurrency = null;
    try {
      validatedCurrency = await validateCurrency(currency, facilityId, currencyModel);
    } catch (err) {
      return reply.code(400).send({
        success: false,
        error: err.message
      });
    }

    // Validate biller address (required)
    let validatedBillerAddress = null;
    try {
      validatedBillerAddress = await validateBillerAddress(billerAddressId, facilityId, billerAddressModel);
    } catch (err) {
      return reply.code(400).send({
        success: false,
        error: err.message
      });
    }

    // Validate GL accounts (required)
    try {
      await validateGLAccounts(glAccounts, facilityId, glAccountModel);
    } catch (err) {
      return reply.code(400).send({
        success: false,
        error: err.message
      });
    }

    // Validate payment method if mobile payment is enabled
    let validatedPaymentMethod = null;
    try {
      validatedPaymentMethod = await validatePaymentMethod(mobilePayment, paymentMethodId, facilityId);
    } catch (err) {
      return reply.code(400).send({
        success: false,
        error: err.message
      });
    }

    // Validate bank account if bank payment is enabled
    let validatedBankAccount = null;
    try {
      validatedBankAccount = await validateBankAccount(bankPayment, bankAccountId, facilityId, bankDetailsModel);
    } catch (err) {
      return reply.code(400).send({
        success: false,
        error: err.message
      });
    }

    // Validate penalty data upfront if provided
    if (penalty && penalty.category) {
      try {
        if (!penalty.name || penalty.name.trim().length === 0) {
          throw new Error('Penalty name is required');
        }

        if (!penalty.effectDays || isNaN(parseInt(penalty.effectDays)) || parseInt(penalty.effectDays) < 1) {
          throw new Error('Effect days must be at least 1');
        }

        // Validate financial penalty fields
        if (['financial', 'both'].includes(penalty.category)) {
          if (!penalty.type) {
            throw new Error('Penalty type is required for financial penalties');
          }

          if (penalty.type === 'fixed') {
            if (!penalty.amount || isNaN(parseFloat(penalty.amount)) || parseFloat(penalty.amount) <= 0) {
              throw new Error('Valid penalty amount is required for fixed penalty type');
            }
          }

          if (penalty.type === 'percentage') {
            if (!penalty.percentage || isNaN(parseFloat(penalty.percentage)) || 
                parseFloat(penalty.percentage) <= 0 || parseFloat(penalty.percentage) > 100) {
              throw new Error('Penalty percentage must be between 1 and 100');
            }
          }
        }

        // Validate enforcement penalty fields
        if (['enforcement', 'both'].includes(penalty.category) && !penalty.enforcementType) {
          throw new Error('Enforcement type is required for enforcement penalties');
        }
      } catch (penaltyValidationErr) {
        return reply.code(400).send({
          success: false,
          error: penaltyValidationErr.message
        });
      }
    }

    // Create levy record with proper ObjectId conversion for references
    const levyData = {
      levyName: levyName.trim(),
      levyType: typeof levyType === 'string' ? new ObjectId(levyType) : levyType,
      amount: parseFloat(amount),
      levyApplicant,
      collectionFrequency,
      invoiceDay,
      dueDate,
      billingType,
      currency: typeof currency === 'string' ? new ObjectId(currency) : currency,
      mobilePayment: mobilePayment || false,
      paymentMethodId: mobilePayment && paymentMethodId ? 
        (typeof paymentMethodId === 'string' ? new ObjectId(paymentMethodId) : paymentMethodId) : null,
      bankPayment: bankPayment || false,
      bankAccountId: bankPayment && bankAccountId ? 
        (typeof bankAccountId === 'string' ? new ObjectId(bankAccountId) : bankAccountId) : null,
      billerAddressId: typeof billerAddressId === 'string' ? new ObjectId(billerAddressId) : billerAddressId,
      glAccounts: {
        invoice: {
          debit: typeof glAccounts.invoice.debit === 'string' ? 
            new ObjectId(glAccounts.invoice.debit) : glAccounts.invoice.debit,
          credit: typeof glAccounts.invoice.credit === 'string' ? 
            new ObjectId(glAccounts.invoice.credit) : glAccounts.invoice.credit
        },
        payment: {
          debit: typeof glAccounts.payment.debit === 'string' ? 
            new ObjectId(glAccounts.payment.debit) : glAccounts.payment.debit,
          credit: typeof glAccounts.payment.credit === 'string' ? 
            new ObjectId(glAccounts.payment.credit) : glAccounts.payment.credit
        }
      },
      facilityId: typeof facilityId === 'string' ? new ObjectId(facilityId) : facilityId,
      disabled: false
    };

    console.log('Creating levy with data:', JSON.stringify(levyData, null, 2));

    const savedLevy = await levyModel.create(levyData);
    console.log('Levy created successfully with ID:', savedLevy._id);

    // Create reminder if provided and update levy with reminderId
    let savedReminder = null;
    if (reminder) {
      try {
        savedReminder = await createReminderRecord(
          reminder,
          savedLevy._id,
          facilityId,
          reminderModel
        );

        if (savedReminder) {
          await levyModel.findByIdAndUpdate(savedLevy._id, {
            reminderId: savedReminder._id
          });
          console.log('Reminder created and linked to levy:', savedReminder._id);
        }
      } catch (reminderErr) {
        console.error('Error creating reminder:', reminderErr);
        // Don't fail the entire operation, just log the error
      }
    }

    // Create penalty if provided and update levy with penaltyId
    let savedPenalty = null;
    if (penalty && penalty.category) {
      try {
        savedPenalty = await createPenaltyRecord(
          penalty,
          savedLevy._id,
          facilityId,
          penaltyModel
        );

        if (savedPenalty) {
          await levyModel.findByIdAndUpdate(savedLevy._id, {
            penaltyId: savedPenalty._id
          });
          console.log('Penalty created and linked to levy:', savedPenalty._id);
        }
      } catch (penaltyErr) {
        console.error('Error creating penalty:', penaltyErr);
        // Log the error but don't fail the operation since penalty validation was done upfront
        console.error('Penalty creation failed after validation:', penaltyErr.message);
      }
    }

    // Manual population approach - no Mongoose populate to avoid schema registration issues
    try {
      const basicLevy = await levyModel.findById(savedLevy._id);
      
      // Manually create populated response using already-validated data
      const populatedLevy = basicLevy.toObject();
      
      // Add populated data from our validated objects
      if (validatedLevyType) {
        populatedLevy.levyType = {
          _id: validatedLevyType._id,
          name: validatedLevyType.name,
          description: validatedLevyType.description
        };
      }

      if (validatedCurrency) {
        populatedLevy.currency = {
          _id: validatedCurrency._id,
          currencyName: validatedCurrency.currencyName,
          currencyShortCode: validatedCurrency.currencyShortCode
        };
      }

      if (validatedBankAccount) {
        populatedLevy.bankAccountId = {
          _id: validatedBankAccount._id,
          bankName: validatedBankAccount.bankName,
          accountNumber: validatedBankAccount.accountNumber,
          accountName: validatedBankAccount.accountName,
          isDefault: validatedBankAccount.isDefault
        };
      }

      if (validatedBillerAddress) {
        populatedLevy.billerAddressId = {
          _id: validatedBillerAddress._id,
          name: validatedBillerAddress.name,
          companyName: validatedBillerAddress.companyName,
          address: validatedBillerAddress.address,
          city: validatedBillerAddress.city,
          email: validatedBillerAddress.email,
          phone: validatedBillerAddress.phone
        };
      }

      // Add reminder and penalty data if they exist
      if (savedReminder) {
        populatedLevy.reminderId = {
          _id: savedReminder._id,
          name: savedReminder.name,
          type: savedReminder.type,
          time: savedReminder.time,
          notificationTypes: savedReminder.notificationTypes
        };
      }

      if (savedPenalty) {
        populatedLevy.penaltyId = {
          _id: savedPenalty._id,
          name: savedPenalty.name,
          category: savedPenalty.category,
          type: savedPenalty.type,
          effectDays: savedPenalty.effectDays,
          amount: savedPenalty.amount,
          percentage: savedPenalty.percentage
        };
      }

      return reply.code(201).send({
        success: true,
        message: "Levy added successfully with all configurations",
        data: {
          levy: populatedLevy,
          reminder: savedReminder,
          penalty: savedPenalty,
          validations: {
            levyType: validatedLevyType,
            currency: validatedCurrency,
            bankAccount: validatedBankAccount,
            billerAddress: validatedBillerAddress,
            paymentMethod: validatedPaymentMethod
          }
        }
      });

    } catch (manualPopulateErr) {
      console.error('Error with manual population:', manualPopulateErr);
      
      // Final fallback - return basic levy data
      try {
        const basicLevy = await levyModel.findById(savedLevy._id);
        
        return reply.code(201).send({
          success: true,
          message: "Levy added successfully (basic data)",
          data: {
            levy: basicLevy,
            reminder: savedReminder,
            penalty: savedPenalty,
            validations: {
              levyType: validatedLevyType,
              currency: validatedCurrency,
              bankAccount: validatedBankAccount,
              billerAddress: validatedBillerAddress,
              paymentMethod: validatedPaymentMethod
            }
          },
          warning: "Some referenced data could not be populated"
        });
      } catch (finalErr) {
        console.error('Error with final fallback:', finalErr);
        
        return reply.code(201).send({
          success: true,
          message: "Levy created successfully but could not retrieve full data",
          data: {
            levyId: savedLevy._id,
            reminder: savedReminder,
            penalty: savedPenalty
          }
        });
      }
    }

  } catch (err) {
    console.error('Error in addLevy:', err);

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

    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return reply.code(400).send({
        success: false,
        error: `A levy with this ${field} already exists in this facility`
      });
    }

    // Handle missing schema errors specifically
    if (err.name === 'MissingSchemaError') {
      return reply.code(500).send({
        success: false,
        error: `Database schema error: ${err.message}. Please contact support.`
      });
    }

    return reply.code(500).send({
      success: false,
      error: err.message || 'Failed to add levy'
    });
  }
};

module.exports = addLevy;