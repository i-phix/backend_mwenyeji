const payservedb = require('payservedb');
const { sendSms } = require('../../../utils/send_new_sms')
const { sendEmail } = require("../../../utils/send_new_email");
const { getModel } = require('../../../utils/getModel');
const cron = require('node-cron');

const CreateCampaign = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            name,
            objective,
            description,
            startDate,
            endDate,
            targetAudience,
            channels,
            message,
            htmlMessage,
            emailSubject,
            campaignType,
            scheduleDate,
            scheduleTime,
            scheduledDates,
            individualUserId
        } = request.body;

        const campaignModel = await getModel('Campaign', payservedb.Campaign.schema, facilityId);

        const campaignData = {
            name,
            objective,
            description,
            startDate,
            endDate,
            targetAudience,
            channels,
            message,
            htmlMessage,
            emailSubject,
            campaignType,
            facilityId,
            recipients: [],
            status: campaignType === 'immediate' ? 'Processing' : 'Scheduled'
        };

        // Add schedule information based on campaign type
        if (campaignType === 'scheduled') {
            campaignData.scheduleDate = scheduleDate;
            campaignData.scheduleTime = scheduleTime;
            campaignData.scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        } else if (campaignType === 'recurring') {
            campaignData.scheduledDates = scheduledDates.map(dt => ({
                date: dt.date,
                time: dt.time,
                scheduledDateTime: new Date(`${dt.date}T${dt.time}`),
                status: 'Pending'
            }));
        }

        // If it's an individual campaign, add the user ID
        if (targetAudience === 'individuals' && individualUserId) {
            campaignData.individualUserId = individualUserId;
        }

        const newCampaign = await campaignModel.create(campaignData);

        // Handle immediate campaigns
        if (campaignType === 'immediate') {
            const recipients = await getRecipientsAndSend(facilityId, targetAudience, individualUserId, channels, message, htmlMessage, emailSubject);

            // Update campaign with recipients and status
            newCampaign.recipients = recipients;
            newCampaign.status = 'Completed';
            await newCampaign.save();

            return reply.code(200).send({
                message: 'Campaign sent successfully',
                campaign: newCampaign,
                recipientCount: recipients.length
            });
        }

        // Handle scheduled campaigns
        if (campaignType === 'scheduled') {
            scheduleOneTimeCampaign(newCampaign._id, facilityId, targetAudience, individualUserId, channels, message, emailSubject, new Date(`${scheduleDate}T${scheduleTime}`));

            return reply.code(200).send({
                message: 'Campaign scheduled successfully',
                campaign: newCampaign,
                scheduledFor: `${scheduleDate} at ${scheduleTime}`
            });
        }

        // Handle recurring campaigns
        if (campaignType === 'recurring') {
            scheduledDates.forEach((dateTime, index) => {
                const scheduledDateTime = new Date(`${dateTime.date}T${dateTime.time}`);
                scheduleRecurringCampaign(newCampaign._id, facilityId, targetAudience, individualUserId, channels, message, emailSubject, scheduledDateTime, index);
            });

            return reply.code(200).send({
                message: 'Recurring campaign scheduled successfully',
                campaign: newCampaign,
                scheduledCount: scheduledDates.length
            });
        }

    } catch (err) {
        return reply.code(400).send({ error: err.message });
    }
};

// Function to get recipients and send messages immediately
const getRecipientsAndSend = async (facilityId, targetAudience, individualUserId, channels, message, htmlMessage, emailSubject) => {
    const recipientsList = [];

    try {
        let users = [];

        // Get users based on target audience
        if (targetAudience === 'tenants') {
            users = await payservedb.User.find({
                type: 'Resident',
                customerData: { $elemMatch: { facilityId } }
            });
        } else if (targetAudience === 'landlords') {
            users = await payservedb.User.find({
                type: 'Landlord',
                customerData: { $elemMatch: { facilityId } }
            });
        } else if (targetAudience === 'all') {
            users = await payservedb.User.find({
                $or: [
                    { type: 'Resident', customerData: { $elemMatch: { facilityId } } },
                    { type: 'Landlord', customerData: { $elemMatch: { facilityId } } }
                ]
            });
        } else if (targetAudience === 'individuals' && individualUserId) {
            const individual = await payservedb.User.findOne({
                "customerData": {
                    $elemMatch: {
                        customerId: individualUserId,
                        facilityId: facilityId
                    }
                }
            });
            if (individual) {
                users = [individual];
            }
        }

        // Filter valid users and send messages
        const validUsers = users.filter(user => user.phoneNumber || user.email);

        for (const user of validUsers) {
            const sentVia = [];
            try {
                if (channels.includes('SMS') && user.phoneNumber) {
                    await sendSms(facilityId, user.phoneNumber, message);
                    sentVia.push('SMS');
                }

                if (channels.includes('Email') && user.email) {
                    await sendEmail(facilityId, user.email, emailSubject || 'Campaign Notification', htmlMessage || message);
                    sentVia.push('Email');
                }

                if (sentVia.length > 0) {
                    recipientsList.push({
                        name: user.fullName,
                        phoneNumber: user.phoneNumber,
                        email: user.email,
                        userId: user._id,
                        sentVia,
                        sentAt: new Date()
                    });
                }
            } catch (error) {
                console.error(`Failed to send to ${user.phoneNumber || user.email}:`, error);
                // Still add to recipients list but mark as failed
                recipientsList.push({
                    name: user.fullName,
                    phoneNumber: user.phoneNumber,
                    email: user.email,
                    userId: user._id,
                    sentVia: [],
                    error: error.message,
                    sentAt: new Date()
                });
            }
        }
    } catch (error) {
        console.error('Error getting recipients:', error);
    }

    return recipientsList;
};

// Function to schedule one-time campaign
const scheduleOneTimeCampaign = (campaignId, facilityId, targetAudience, individualUserId, channels, message, emailSubject, scheduledDateTime) => {
    const cronExpression = `${scheduledDateTime.getMinutes()} ${scheduledDateTime.getHours()} ${scheduledDateTime.getDate()} ${scheduledDateTime.getMonth() + 1} *`;

    cron.schedule(cronExpression, async () => {
        try {
            const recipients = await getRecipientsAndSend(facilityId, targetAudience, individualUserId, channels, message, emailSubject);

            // Update campaign status
            const campaignModel = await getModel('Campaign', payservedb.Campaign.schema, facilityId);
            await campaignModel.findByIdAndUpdate(campaignId, {
                recipients: recipients,
                status: 'Completed',
                executedAt: new Date()
            });

        } catch (error) {
            console.error(`Error executing scheduled campaign ${campaignId}:`, error);

            // Update campaign status to failed
            const campaignModel = await getModel('Campaign', payservedb.Campaign.schema, facilityId);
            await campaignModel.findByIdAndUpdate(campaignId, {
                status: 'Failed',
                error: error.message,
                executedAt: new Date()
            });
        }
    }, {
        scheduled: true,
        timezone: "Africa/Nairobi" // Adjust timezone as needed
    });
};

// Function to schedule recurring campaign
const scheduleRecurringCampaign = (campaignId, facilityId, targetAudience, individualUserId, channels, message, emailSubject, scheduledDateTime, dateIndex) => {
    const cronExpression = `${scheduledDateTime.getMinutes()} ${scheduledDateTime.getHours()} ${scheduledDateTime.getDate()} ${scheduledDateTime.getMonth() + 1} *`;

    cron.schedule(cronExpression, async () => {
        try {
            const recipients = await getRecipientsAndSend(facilityId, targetAudience, individualUserId, channels, message, emailSubject);

            // Update specific scheduled date status
            const campaignModel = await getModel('Campaign', payservedb.Campaign.schema, facilityId);
            const campaign = await campaignModel.findById(campaignId);

            if (campaign && campaign.scheduledDates && campaign.scheduledDates[dateIndex]) {
                campaign.scheduledDates[dateIndex].status = 'Completed';
                campaign.scheduledDates[dateIndex].executedAt = new Date();
                campaign.recipients = recipients;

                // Check if all scheduled dates are completed
                const allCompleted = campaign.scheduledDates.every(sd => sd.status === 'Completed');
                if (allCompleted) {
                    campaign.status = 'Completed';
                }

                await campaign.save();
            }

        } catch (error) {
            // Update specific scheduled date status to failed
            const campaignModel = await getModel('Campaign', payservedb.Campaign.schema, facilityId);
            const campaign = await campaignModel.findById(campaignId);

            if (campaign && campaign.scheduledDates && campaign.scheduledDates[dateIndex]) {
                campaign.scheduledDates[dateIndex].status = 'Failed';
                campaign.scheduledDates[dateIndex].error = error.message;
                campaign.scheduledDates[dateIndex].executedAt = new Date();
                await campaign.save();
            }
        }
    }, {
        scheduled: true,
        timezone: "Africa/Nairobi"
    });
};

module.exports = CreateCampaign;