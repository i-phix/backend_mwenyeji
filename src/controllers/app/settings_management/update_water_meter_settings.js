const utilityDb = require('../../../middlewares/utilityDb');

const update_water_meter_settings = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      minAmount,
      maxAmount,
      lowThreshold,
      highThreshold,
      freeWaterAllowance,
      gracePeriod,
      invoiceDay,
      enforcePayment,
      minimumPaymentAmount,
      tariff,
      tariffAmount,
      tariffAmountSmart,
      fixedTariffAmount,
      meterLoan,
      standingCharge,
      billerAddress,
      glAccounts,
      paymentMethods,
      discounts,
      otherCharges,
      sewerageCharge,
      fixedCharge,
      vatPercentage,
      notifications
    } = request.body;

    if (!facilityId) {
      return reply.code(400).send({ success: false, error: 'Facility ID is required' });
    }

    if (!request.body || Object.keys(request.body).length === 0) {
      return reply.code(400).send({ success: false, error: 'Update data is required' });
    }

    const WaterMeterSettingsModel = await utilityDb.getModel('WaterMeterSettings');

    const existingSettings = await WaterMeterSettingsModel.findOne({ facilityId });
    if (!existingSettings) {
      return reply.code(404).send({
        success: false,
        error: 'Water meter settings not found for this facility'
      });
    }

    const updateData = {};

    if (minAmount !== undefined) updateData.minAmount = minAmount;
    if (maxAmount !== undefined) updateData.maxAmount = maxAmount;
    if (lowThreshold !== undefined) updateData.lowThreshold = lowThreshold;
    if (highThreshold !== undefined) updateData.highThreshold = highThreshold;
    if (freeWaterAllowance !== undefined) updateData.freeWaterAllowance = freeWaterAllowance;
    if (gracePeriod !== undefined) updateData.gracePeriod = gracePeriod;
    if (invoiceDay !== undefined) updateData.invoiceDay = invoiceDay;
    if (enforcePayment !== undefined) updateData.enforcePayment = enforcePayment;
    if (minimumPaymentAmount !== undefined) updateData.minimumPaymentAmount = minimumPaymentAmount;
    if (tariff !== undefined) updateData.tariff = tariff;
    if (tariffAmount !== undefined) updateData.tariffAmount = tariffAmount;
    if (tariffAmountSmart !== undefined) updateData.tariffAmountSmart = tariffAmountSmart;
    if (fixedTariffAmount !== undefined) updateData.fixedTariffAmount = fixedTariffAmount;
    if (meterLoan !== undefined) updateData.meterLoan = meterLoan;
    if (standingCharge !== undefined) updateData.standingCharge = standingCharge;
    if (otherCharges !== undefined) updateData.otherCharges = otherCharges;
    if (sewerageCharge !== undefined) updateData.sewerageCharge = sewerageCharge;
    if (fixedCharge !== undefined) updateData.fixedCharge = fixedCharge;
    if (vatPercentage !== undefined) updateData.vatPercentage = vatPercentage;

    if (discounts !== undefined) {
      updateData.discounts = discounts;
    }

    if (notifications !== undefined) {
      updateData.notifications = {
        usageAlerts: {
          enabled: notifications.usageAlerts?.enabled || false,
          daily: notifications.usageAlerts?.daily || false,
          weekly: notifications.usageAlerts?.weekly || false,
          monthly: notifications.usageAlerts?.monthly || false
        },
        statements: {
          enabled: notifications.statements?.enabled || false
        },
        paymentReminders: {
          enabled: notifications.paymentReminders?.enabled || false,
          daysBeforeDue: notifications.paymentReminders?.daysBeforeDue || 3,
          frequency: notifications.paymentReminders?.frequency || 'once'
        }
      };
    }

    if (billerAddress) {
      updateData.billerAddress = {
        name: billerAddress.name?.trim() || '',
        email: billerAddress.email?.toLowerCase().trim() || '',
        phone: billerAddress.phone?.trim() || '',
        address: billerAddress.address?.trim() || '',
        city: billerAddress.city?.trim() || ''
      };
    }

    // Only update glAccounts if there are actual non-null values
    if (glAccounts) {
      const hasValidGlAccounts = 
        (glAccounts.invoice?.debit && glAccounts.invoice.debit !== null) ||
        (glAccounts.invoice?.credit && glAccounts.invoice.credit !== null) ||
        (glAccounts.payment?.debit && glAccounts.payment.debit !== null) ||
        (glAccounts.payment?.credit && glAccounts.payment.credit !== null);

      if (hasValidGlAccounts) {
        updateData.glAccounts = {
          invoice: {
            debit: (glAccounts.invoice?.debit && glAccounts.invoice.debit !== null) ? glAccounts.invoice.debit : existingSettings.glAccounts?.invoice?.debit || null,
            credit: (glAccounts.invoice?.credit && glAccounts.invoice.credit !== null) ? glAccounts.invoice.credit : existingSettings.glAccounts?.invoice?.credit || null
          },
          payment: {
            debit: (glAccounts.payment?.debit && glAccounts.payment.debit !== null) ? glAccounts.payment.debit : existingSettings.glAccounts?.payment?.debit || null,
            credit: (glAccounts.payment?.credit && glAccounts.payment.credit !== null) ? glAccounts.payment.credit : existingSettings.glAccounts?.payment?.credit || null
          }
        };
      }
    }

    if (paymentMethods) {
      updateData.paymentMethods = {
        mobilePayment: {
          status: paymentMethods.mobilePayment?.status || false,
          paymentId: (paymentMethods.mobilePayment?.status && paymentMethods.mobilePayment?.paymentId)
            ? paymentMethods.mobilePayment.paymentId
            : null
        },
        bankPayment: {
          status: paymentMethods.bankPayment?.status || false,
          paymentId: (paymentMethods.bankPayment?.status && paymentMethods.bankPayment?.paymentId)
            ? paymentMethods.bankPayment.paymentId
            : null
        }
      };
    }

    const updatedSettings = await WaterMeterSettingsModel.findOneAndUpdate(
      { facilityId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return reply.code(200).send({
      success: true,
      message: 'Water meter settings updated successfully',
      data: updatedSettings
    });

  } catch (err) {
    console.error('Error in update_water_meter_settings:', err);

    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(error => error.message);
      return reply.code(400).send({ success: false, error: 'Validation failed', details: validationErrors });
    }

    if (err.name === 'CastError') {
      return reply.code(400).send({ success: false, error: 'Invalid data format provided', details: err.message });
    }

    if (err.code === 11000) {
      return reply.code(409).send({ success: false, error: 'Duplicate key error during update' });
    }

    return reply.code(500).send({
      success: false,
      error: 'Internal server error while updating water meter settings',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Contact system administrator'
    });
  }
};

module.exports = update_water_meter_settings;