const payservedb = require('payservedb');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const import_kra_pins = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Use request.file (multer property) — same pattern as import_meters
    const file = request.file;
    if (!file) {
      return reply.code(400).send({
        success: false,
        error: 'No file uploaded.',
        message: 'No file uploaded.',
      });
    }

    const filePath = file.path;
    const extension = path.extname(file.originalname).toLowerCase();

    if (!['.xlsx', '.xls'].includes(extension)) {
      fs.unlinkSync(filePath);
      return reply.code(400).send({
        success: false,
        error: 'Invalid file type. Please upload an .xlsx or .xls file.',
        message: 'Invalid file type. Please upload an .xlsx or .xls file.',
      });
    }

    const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // Clean up uploaded file immediately after reading
    fs.unlinkSync(filePath);

    if (!rows || rows.length === 0) {
      return reply.code(400).send({
        success: false,
        error: 'The uploaded Excel file is empty.',
        message: 'The uploaded Excel file is empty.',
      });
    }

    // Normalize column headers (trim + lowercase, strip spaces) for flexible matching
    const normalizeKey = (key) => key.trim().toLowerCase().replace(/\s+/g, '');

    const results = {
      total: rows.length,
      updated: 0,
      notFound: 0,
      skipped: 0,
      errors: [],
      details: [],
    };

    for (const [index, row] of rows.entries()) {
      // Build a normalized key map so "KRA PIN", "kra_pin", "krapin" all match
      const normalizedRow = {};
      for (const key of Object.keys(row)) {
        normalizedRow[normalizeKey(key)] = row[key];
      }

      const email = normalizedRow['email']?.toString().trim().toLowerCase();
      // Accept "krapin", "kra_pin", "kra pin" column headers
      const kraPin =
        (normalizedRow['krapin'] || normalizedRow['kra_pin'] || normalizedRow['krapin'] || '')
          .toString()
          .trim()
          .toUpperCase() || null;

      if (!email) {
        results.skipped++;
        results.details.push({
          row: index + 2,
          email: null,
          kraPin: kraPin || null,
          status: 'skipped',
          reason: 'Missing email',
        });
        continue;
      }

      if (!kraPin) {
        results.skipped++;
        results.details.push({
          row: index + 2,
          email,
          kraPin: null,
          status: 'skipped',
          reason: 'Missing KRA PIN',
        });
        continue;
      }

      try {
        const customer = await payservedb.Customer.findOne({
          email: { $regex: new RegExp(`^${email}$`, 'i') },
          facilityId,
        });

        if (!customer) {
          results.notFound++;
          results.details.push({
            row: index + 2,
            email,
            kraPin,
            status: 'not_found',
            reason: `No customer found with email "${email}" in this facility`,
          });
          continue;
        }

        await payservedb.Customer.updateOne(
          { _id: customer._id },
          { $set: { kraPin } }
        );

        results.updated++;
        results.details.push({
          row: index + 2,
          email,
          kraPin,
          customerId: customer._id,
          customerName: `${customer.firstName} ${customer.lastName}`,
          status: 'updated',
        });
      } catch (rowError) {
        results.errors.push({ row: index + 2, email, kraPin, error: rowError.message });
        results.details.push({
          row: index + 2,
          email,
          kraPin,
          status: 'error',
          reason: rowError.message,
        });
      }
    }

    return reply.code(200).send({
      success: true,
      message: `Import complete. ${results.updated} updated, ${results.notFound} not found, ${results.skipped} skipped.`,
      data: results,
    });
  } catch (err) {
    // Clean up file if something went wrong before we could delete it
    if (request.file && request.file.path) {
      try { fs.unlinkSync(request.file.path); } catch (_) {}
    }
    console.error('import_kra_pins error:', err);
    return reply.code(502).send({
      success: false,
      error: err.message,
      message: err.message,
    });
  }
};

module.exports = import_kra_pins;