/**
 * Generate invoice for a booking reservation
 * This function creates an invoice when a booking is made and returns the invoice ID
 * 
 * @param {Object} reservation - The booking reservation data
 * @param {Object} facilityId - The ID of the facility
 * @returns {Promise<object>} - The generated invoice ID and number
 */
const generateInvoice = async (reservation, facilityId) => {
  try {
    //console.log('Generating invoice for reservation:', reservation._id || reservation.bookingReservationId);
    
    // Format the current date for the invoice number
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    
    // Generate a unique invoice number and ID
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const invoiceId = `INV-${year}${month}${day}-${randomDigits}`;
    const invoiceNumber = `${year}${month}${day}${randomDigits}`;
    
    return { invoiceId, invoiceNumber };
  } catch (error) {
    //console.error('Error generating invoice:', error);
    throw new Error(`Failed to generate invoice: ${error.message}`);
  }
};

module.exports = generateInvoice;