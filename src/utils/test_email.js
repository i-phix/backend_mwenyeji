const nodemailer = require('nodemailer');

// CONFIGURATION
const mailConfig = {
    host: 'mail.swanfacilities.com',     // Replace with your SMTP server
    port: 587,                       // Use 465 for secure, 587 for TLS (non-secure)
    secure: false,                    // True for port 465, false for 587
    auth: {
        user: 'landlord@swanfacilities.com',   // Replace with your email
        pass: 'Fwna3#MdwJMv',   // Replace with your email password
    },
};

// EMAIL DETAILS
const mailOptions = {
    from: 'landlord@swanfacilities.com',   // Sender address
    to: 'johnkaiser964@gmail.com',                   // List of receivers
    subject: 'Email testing',            // Subject line
    html: `
    <h1>Test 123</h1>

  `,                                             // HTML body
};

// SEND FUNCTION
async function sendEmail() {
    const transporter = nodemailer.createTransport(mailConfig);

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
    } catch (error) {
        console.error('❌ Error sending email:', error);
    }
}

// RUN
sendEmail();