const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF invoice for booking reservations
 * @param {Object} invoiceData - Invoice data object
 * @param {Object} reservationData - Reservation data object
 * @param {Object} propertyData - Property data object
 * @param {Object} unitData - Unit data object
 * @param {Object} currencyData - Currency data object
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateBookingInvoicePDF(invoiceData, reservationData, propertyData, unitData, currencyData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const chunks = [];

            // Collect PDF data
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Colors - Enhanced professional palette
            const primaryColor = '#2C3E50';
            const accentColor = '#3498DB';
            const successColor = '#27AE60';
            const warningColor = '#F39C12';
            const dangerColor = '#E74C3C';
            const grayColor = '#7F8C8D';
            const lightGray = '#ECF0F1';

            // Get status color
            const getStatusColor = (status) => {
                switch (status.toLowerCase()) {
                    case 'paid': return successColor;
                    case 'partially paid': return warningColor;
                    case 'pending': return dangerColor;
                    default: return grayColor;
                }
            };

            // Header with colored background
            doc.rect(0, 0, 600, 130)
                .fill(primaryColor);

            // Header title
            doc.fontSize(28)
                .fillColor('white')
                .font('Helvetica-Bold')
                .text('BOOKING INVOICE', 50, 45, { align: 'left' });

            doc.fontSize(10)
                .fillColor(lightGray)
                .font('Helvetica')
                .text('Tax Invoice', 50, 80);

            // Invoice status badge - positioned in header
            const statusColor = getStatusColor(invoiceData.paymentStatus);
            const statusText = invoiceData.paymentStatus.toUpperCase();

            // Status background box
            doc.roundedRect(420, 45, 130, 30, 3)
                .fill(statusColor);

            doc.fontSize(12)
                .fillColor('white')
                .font('Helvetica-Bold')
                .text(statusText, 420, 54, { width: 130, align: 'center' });

            // Invoice details (right side) - in white text on dark background
            doc.fontSize(10)
                .fillColor('white')
                .font('Helvetica')
                .text(`Invoice No: ${invoiceData.invoiceNumber || invoiceData.invoiceId}`, 350, 85, { align: 'right' })
                .text(`Date: ${new Date(invoiceData.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, 350, 100, { align: 'right' })
                .text(`Booking Ref: ${reservationData.bookingReservationId || reservationData.reservationId || 'N/A'}`, 350, 115, { align: 'right' });

            // Decorative line separator
            doc.moveTo(50, 145)
                .lineTo(550, 145)
                .strokeColor(accentColor)
                .lineWidth(2)
                .stroke();

            // Reset line width
            doc.lineWidth(1);

            // Guest Information
            let currentY = 165;

            // Section background box
            doc.roundedRect(45, currentY, 250, 115, 5)
                .fillAndStroke(lightGray, '#BDC3C7');

            currentY += 10;
            doc.fontSize(13)
                .fillColor(primaryColor)
                .font('Helvetica-Bold')
                .text('Guest Information', 55, currentY);

            currentY += 25;
            doc.fontSize(10)
                .fillColor('black')
                .font('Helvetica')
                .text(`Name: ${reservationData.guestInfo?.name || 'N/A'}`, 55, currentY);

            currentY += 18;
            doc.text(`Email: ${reservationData.guestInfo?.email || 'N/A'}`, 55, currentY);

            currentY += 18;
            doc.text(`Phone: ${reservationData.guestInfo?.phone || 'N/A'}`, 55, currentY);

            if (reservationData.guestInfo?.address) {
                currentY += 18;
                doc.text(`Address: ${reservationData.guestInfo.address}`, 55, currentY);
            }

            // Property Information - right side box
            currentY = 165;
            doc.roundedRect(305, currentY, 245, 115, 5)
                .fillAndStroke(lightGray, '#BDC3C7');

            currentY += 10;
            doc.fontSize(13)
                .fillColor(primaryColor)
                .font('Helvetica-Bold')
                .text('Property Details', 315, currentY);

            currentY += 25;
            doc.fontSize(10)
                .fillColor('black')
                .font('Helvetica')
                .text(`Property Type: ${unitData?.unitType || 'N/A'}`, 315, currentY);

            currentY += 18;
            doc.text(`Unit: ${unitData?.name || 'N/A'}${unitData?.division ? ` (${unitData.division})` : ''}`, 315, currentY);

            // Booking Period - full width box
            currentY = 295;
            doc.roundedRect(45, currentY, 505, 110, 5)
                .fillAndStroke(lightGray, '#BDC3C7');

            currentY += 10;
            doc.fontSize(13)
                .fillColor(primaryColor)
                .font('Helvetica-Bold')
                .text('Booking Period', 55, currentY);

            // Helper function for readable date format
            const formatDate = (date) => {
                const d = new Date(date);
                return d.toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            };

            currentY += 25;
            doc.fontSize(10)
                .fillColor('black')
                .font('Helvetica')
                .text(`Check-in: ${formatDate(reservationData.checkIn)}`, 55, currentY);

            currentY += 18;
            doc.text(`Check-out: ${formatDate(reservationData.checkOut)}`, 55, currentY);

            currentY += 18;
            doc.text(`Number of Nights: ${invoiceData.stayPeriod?.nights || 0}`, 55, currentY);

            currentY += 18;
            doc.text(`Guests: ${reservationData.guests?.adults || reservationData.numberOfGuests?.adults || 1} Adult(s), ${reservationData.guests?.children || reservationData.numberOfGuests?.children || 0} Child(ren)`, 55, currentY);

            currentY = 420;

            // Special Requests
            if (reservationData.specialRequests) {
                doc.roundedRect(45, currentY, 505, 50, 5)
                    .fillAndStroke('#FFF9E6', '#F39C12');

                currentY += 12;
                doc.fontSize(10)
                    .fillColor(grayColor)
                    .font('Helvetica-Oblique')
                    .text(`Special Requests: ${reservationData.specialRequests}`, 55, currentY, { width: 485 });
                currentY += 50;
            }

            // Decorative line separator
            currentY += 10;
            doc.moveTo(50, currentY)
                .lineTo(550, currentY)
                .strokeColor(accentColor)
                .lineWidth(2)
                .stroke();

            doc.lineWidth(1);

            // Invoice Items Table
            currentY += 20;
            doc.fontSize(14)
                .fillColor(primaryColor)
                .font('Helvetica-Bold')
                .text('Invoice Summary', 50, currentY);

            currentY += 30;

            // Table header
            const tableTop = currentY;
            const descriptionX = 50;
            const quantityX = 300;
            const priceX = 380;
            const amountX = 480;

            doc.roundedRect(50, tableTop, 500, 28, 3)
                .fill(accentColor);

            doc.fontSize(11)
                .fillColor('white')
                .font('Helvetica-Bold')
                .text('Description', descriptionX + 10, tableTop + 10)
                .text('Qty', quantityX, tableTop + 10)
                .text('Unit Price', priceX, tableTop + 10, { width: 90, align: 'right' })
                .text('Amount', amountX, tableTop + 10, { width: 70, align: 'right' });

            currentY = tableTop + 35;

            // Invoice charges
            const charges = invoiceData.charges || [];
            const currency = currencyData?.currencyShortCode || currencyData?.code || 'KES';

            charges.forEach((charge, index) => {
                const rowColor = index % 2 === 0 ? lightGray : 'white';
                doc.roundedRect(50, currentY - 5, 500, 24, 2).fill(rowColor);

                doc.fontSize(10)
                    .fillColor('black')
                    .font('Helvetica')
                    .text(charge.description || 'Accommodation', descriptionX + 10, currentY)
                    .text(charge.quantity || 1, quantityX, currentY)
                    .text(`${currency} ${(charge.unitPrice || 0).toFixed(2)}`, priceX, currentY, { width: 90, align: 'right' })
                    .text(`${currency} ${(charge.amount || 0).toFixed(2)}`, amountX, currentY, { width: 70, align: 'right' });

                currentY += 24;
            });

            // Totals
            currentY += 15;
            doc.moveTo(380, currentY)
                .lineTo(550, currentY)
                .strokeColor(accentColor)
                .lineWidth(1)
                .stroke();

            currentY += 18;

            // Subtotal
            const subtotal = invoiceData.totalAmount || 0;
            doc.fontSize(11)
                .fillColor('black')
                .font('Helvetica')
                .text('Subtotal:', 380, currentY)
                .text(`${currency} ${subtotal.toFixed(2)}`, amountX, currentY, { width: 70, align: 'right' });

            // Payment history
            if (invoiceData.paymentHistory && invoiceData.paymentHistory.length > 0) {
                currentY += 22;
                doc.fontSize(11)
                    .fillColor(successColor)
                    .font('Helvetica')
                    .text('Amount Paid:', 380, currentY);

                const totalPaid = invoiceData.paymentHistory.reduce((sum, p) => sum + (p.amount || 0), 0);
                doc.fillColor(successColor)
                    .text(`${currency} ${totalPaid.toFixed(2)}`, amountX, currentY, { width: 70, align: 'right' });
            }

            // Balance/Total
            currentY += 28;
            const totalPaid = invoiceData.paymentHistory?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
            const balance = subtotal - totalPaid;

            const balanceBoxColor = balance > 0 ? '#FFF3CD' : '#D5F4E6';
            const balanceBorderColor = balance > 0 ? warningColor : successColor;
            const balanceTextColor = balance > 0 ? '#856404' : '#155724';

            doc.roundedRect(380, currentY - 8, 170, 38, 4)
                .fillAndStroke(balanceBoxColor, balanceBorderColor);

            doc.fontSize(13)
                .fillColor(balanceTextColor)
                .font('Helvetica-Bold')
                .text(balance > 0 ? 'Balance Due:' : 'Total Paid:', 390, currentY + 2)
                .text(`${currency} ${Math.abs(balance).toFixed(2)}`, amountX - 10, currentY + 2, { width: 80, align: 'right' });

            // Payment History Details
            if (invoiceData.paymentHistory && invoiceData.paymentHistory.length > 0) {
                currentY += 60;
                doc.fontSize(13)
                    .fillColor(primaryColor)
                    .font('Helvetica-Bold')
                    .text('Payment History', 50, currentY);

                currentY += 25;

                invoiceData.paymentHistory.forEach((payment, index) => {
                    const rowColor = index % 2 === 0 ? lightGray : 'white';
                    doc.roundedRect(50, currentY - 5, 500, 22, 2).fill(rowColor);

                    doc.fontSize(10)
                        .fillColor('black')
                        .font('Helvetica')
                        .text(`${index + 1}. ${payment.paymentMethod?.toUpperCase() || 'N/A'} - ${currency} ${payment.amount.toFixed(2)}`, 60, currentY)
                        .text(`Date: ${new Date(payment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, 300, currentY)
                        .text(`Ref: ${payment.transactionId || 'N/A'}`, 440, currentY);

                    currentY += 22;
                });
            }

            // Footer
            const footerY = 750;

            // Footer background
            doc.rect(0, footerY - 10, 600, 100)
                .fill(lightGray);

            doc.moveTo(50, footerY)
                .lineTo(550, footerY)
                .strokeColor(accentColor)
                .lineWidth(2)
                .stroke();

            doc.fontSize(11)
                .fillColor(primaryColor)
                .font('Helvetica-Bold')
                .text('Thank you for your booking!', 50, footerY + 15, { align: 'center', width: 500 });

            doc.fontSize(9)
                .fillColor(grayColor)
                .font('Helvetica')
                .text(`This is a computer-generated invoice. For inquiries, quote: ${invoiceData.invoiceNumber || invoiceData.invoiceId}`, 50, footerY + 35, { align: 'center', width: 500 });

            // Finalize PDF
            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateBookingInvoicePDF };
