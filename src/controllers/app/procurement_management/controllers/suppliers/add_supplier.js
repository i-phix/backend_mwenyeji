const payservedb = require('payservedb');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getModel } = require('../../../../../utils/getModel');
const { sendSms } = require("../../../../../utils/send_new_sms");
const { sendEmail } = require("../../../../../utils/send_new_email");

const add_supplier = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            name,
            email,
            phone,
            contactPerson,
            department,
            taxIdentificationNumber
        } = request.body;

        // Basic validation
        if (!name || !email || !phone) {
            return reply.code(400).send({
                error: 'Name, email, and phone are required fields'
            });
        }

        const supplierModel = await getModel('Supplier', payservedb.Supplier.schema, facilityId);
        
        // Format phone number to ensure consistent lookup
        const filteredPhone = phone.trim().slice(-9);
        
        // Process any uploaded documents
        const documents = [];
        if (request.files && request.files.length > 0) {
            for (const file of request.files) {
                const document = `uploads/${path.basename(file.path)}`;
                const documentName = request.body[`documentName_${file.fieldname.split('_')[1]}`] || file.originalname;
                const documentType = request.body[`documentType_${file.fieldname.split('_')[1]}`] || 'other';
                
                documents.push({
                    documentName,
                    documentType,
                    document
                });
            }
        }

        // Check if supplier already exists in this facility
        const existingSupplier = await supplierModel.findOne({ phone: filteredPhone });
        if (existingSupplier) {
            return reply.code(400).send({
                error: 'A supplier with this phone number already exists in this facility'
            });
        }

        // Check if user already exists in the main users table
        let userId;
        let newUserCreated = false;
        const existingUser = await payservedb.User.findOne({ phoneNumber: filteredPhone });

        if (existingUser) {
            // User exists, just use their ID
            userId = existingUser._id;
        } else {
            // Create a new user with role 'Supplier'
            const password = 'PXDS' + Math.floor(1000 + Math.random() * 9000); 
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const newUser = new payservedb.User({
                fullName: name,
                email,
                phoneNumber: filteredPhone,
                type: 'Company',
                role: 'supplier',
                kyc: {},
                password: hashedPassword
            });

            const savedUser = await newUser.save();
            userId = savedUser._id;
            newUserCreated = true;

            // Send login credentials using the new notification system
            try {
                // Get facility details for notifications
                const facilityDetails = await payservedb.Facility.findById(facilityId).lean();
                const facilityName = facilityDetails?.name || 'PayServe';

                // Create login link (adjust URL as needed for your application)
                const loginLink = process.env.SUPPLIER_PORTAL_URL || 'https://supplier.payserve.co.ke/login';
                const resetPasswordLink = `https://app.payserve.co.ke/reset_password/${savedUser._id}`;

                // Email content
                const emailSubject = `Welcome to ${facilityName} Supplier Portal - Your Login Credentials`;
                
                const emailMessage = `
Dear ${name},

Welcome to ${facilityName}! Your supplier account has been created successfully for our procurement system.

Login Details:
- Portal: ${loginLink}
- Username: ${email}
- Password: ${password}

For security, we recommend changing your password after your first login.
Reset your password here: ${resetPasswordLink}

You can now participate in procurement opportunities from ${facilityName}.

If you have any questions or need assistance, please contact our procurement team.

Best regards,
${facilityName} Procurement Team
                `.trim();

                const emailHtml = `
<h2>Welcome to ${facilityName} Supplier Portal</h2>
<p>Dear ${name},</p>

<p>Welcome to ${facilityName}! Your supplier account has been created successfully for our procurement system.</p>

<h3>Login Details:</h3>
<ul>
    <li><strong>Portal:</strong> <a href="${loginLink}">${loginLink}</a></li>
    <li><strong>Username:</strong> ${email}</li>
    <li><strong>Password:</strong> ${password}</li>
</ul>

<p>For security, we recommend changing your password after your first login.</p>

<p><a href="${resetPasswordLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>

<p>You can now participate in procurement opportunities from ${facilityName}.</p>

<p>If you have any questions or need assistance, please contact our procurement team.</p>

<p>Best regards,<br>${facilityName} Procurement Team</p>
                `;

                const smsMessage = `Dear ${name}, welcome to ${facilityName}! Your supplier portal access: ${loginLink} Username: ${email} Password: ${password}`;

                // Send email notification
                await sendEmail(
                    facilityId,
                    email,
                    emailSubject,
                    emailMessage,
                    emailHtml,
                    facilityName
                );

                // Send SMS notification
                await sendSms(
                    facilityId,
                    filteredPhone,
                    smsMessage
                );

            } catch (notificationError) {
                console.error('Error sending supplier credentials:', notificationError);
                // Don't fail the supplier creation process just because notifications failed
            }
        }

        // Create the new supplier document with userId
        const newSupplier = {
            facilityId,
            name,
            email,
            phone: filteredPhone,
            contactPerson: { name: contactPerson?.name || '' },
            department: { name: department?.name || '' },
            taxIdentificationNumber,
            documents,
            status: 'active',
            userId 
        };
        
        const savedSupplier = await supplierModel.create(newSupplier);
        
        return reply.code(200).send({
            message: 'Supplier added successfully',
            data: savedSupplier,
            newUserCreated 
        });
    } catch (err) {
        console.error('Error in adding supplier:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = add_supplier;