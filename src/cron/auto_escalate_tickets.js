const payservedb = require('payservedb');
const logger = require('../../config/winston');
const { sendSms } = require('../utils/send_new_sms');
const { sendEmail } = require('../utils/send_new_email');

async function getEscalationSettings() {
  const settings = await payservedb.Settings.findOne({
    name: 'customer_obsession_global',
    size: 'global'
  }).select('escalation_timer_minutes escalation_target_level').lean();

  return {
    timerMinutes: settings?.escalation_timer_minutes ?? null,
    targetLevel: settings?.escalation_target_level ?? 3
  };
}

async function findEscalationTarget(targetLevel) {
  try {
    const roles = await payservedb.AgentRole.find({
      level: targetLevel,
      active: true
    }).select('code').lean();

    let roleCodes = roles.map(r => r.code);

    if (roleCodes.length === 0) {
      // Fallback: any role at or above targetLevel
      const higherRoles = await payservedb.AgentRole.find({
        level: { $gte: targetLevel },
        active: true
      }).select('code').lean();
      roleCodes = higherRoles.map(r => r.code);
    }

    if (roleCodes.length === 0) {
      logger.warn(`No active roles found for level ${targetLevel}`);
      return null;
    }

    return payservedb.Agent.findOne({
      role: { $in: roleCodes },
      status: 'active'
    })
      .sort({ is_available: -1, updated_at: -1 })
      .lean();
  } catch (err) {
    logger.error(`Error finding escalation target: ${err.message}`);
    return null;
  }
}

async function autoEscalateTickets() {
  try {
    const { timerMinutes, targetLevel } = await getEscalationSettings();

    if (!timerMinutes || Number(timerMinutes) <= 0) {
      logger.info('Auto-escalation skipped: escalation_timer_minutes is not configured');
      return { success: true, skipped: true, reason: 'timer_not_configured' };
    }

    const manager = await findEscalationTarget(targetLevel);
    if (!manager || !manager.user_id) {
      logger.warn('Auto-escalation skipped: no active escalation target found');
      return { success: true, skipped: true, reason: 'manager_not_found' };
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - Number(timerMinutes) * 60 * 1000);

    const tickets = await payservedb.CustomerTicket.find({
      status: { $nin: ['resolved', 'closed', 'escalated'] },
      created_at: { $lte: cutoff }
    })
      .select('_id ticket_number status created_at assigned_agent_id')
      .lean();

    if (tickets.length === 0) {
      logger.info('Auto-escalation check complete: no overdue tickets found');
      return { success: true, escalated: 0 };
    }

    let escalatedCount = 0;

    for (const ticket of tickets) {
      try {
        await payservedb.CustomerTicket.findByIdAndUpdate(ticket._id, {
          status: 'escalated',
          escalation_level: 'level_3',
          assigned_agent_id: manager.user_id,
          escalated_to: manager.user_id,
          escalated_at: now,
          escalation_reason: 'auto_escalation_timer',
          updated_at: now,
          $push: {
            interactions: {
              agent_id: null,
              message: 'AUTO-ESCALATED: Timer expired. Escalated to 3rd Level Support.',
              is_internal_note: true,
              created_at: now
            },
            activity_log: {
              agent_id: null,
              action: 'auto_escalate',
              description: 'AUTO-ESCALATED: Timer expired. Escalated to 3rd Level Support.',
              metadata: {
                escalation_reason: 'auto_escalation_timer',
                escalation_level: 'level_3',
                escalated_to_agent_id: manager.agent_id,
                escalation_timer_minutes: Number(timerMinutes)
              },
              timestamp: now
            }
          }
        });

        await payservedb.AgentNotification.create({
          user_id: manager.user_id,
          type: 'ticket_escalated',
          title: 'Ticket Auto-Escalated',
          message: `Ticket #${ticket.ticket_number} was auto-escalated by timer.`,
          ticket_id: ticket._id,
          ticket_number: ticket.ticket_number,
          link: `/agent/tickets/${ticket._id}`,
          metadata: {
            escalation_reason: 'auto_escalation_timer',
            escalation_level: 'level_3'
          }
        });

        escalatedCount += 1;
        logger.info(`Auto-escalated ticket ${ticket.ticket_number} to manager ${manager.agent_id}`);
      } catch (ticketError) {
        logger.error(`Failed to auto-escalate ticket ${ticket.ticket_number}: ${ticketError.message}`);
      }
    }

    if (escalatedCount > 0) {
      const facilityId = null; // auto-escalation is system-wide, no single facility
      if (manager.phone) {
        const smsMessage = `${escalatedCount} ticket(s) auto-escalated to you due to timer expiry. Login to review.`;
        sendSms(facilityId, manager.phone, smsMessage).catch(err =>
          logger.error(`Failed to send auto-escalation SMS to agent ${manager.agent_id}: ${err.message}`)
        );
      }
      if (manager.email) {
        const ticketList = tickets
          .filter((_, i) => i < escalatedCount)
          .map(t => `  - Ticket #${t.ticket_number}`)
          .join('\n');
        const emailText = `Hi ${manager.name},\n\n${escalatedCount} ticket(s) have been automatically escalated to you because they exceeded the configured response timer.\n\nTickets:\n${ticketList}\n\nPlease log in to review and action these tickets.\n\nPayServe Customer Obsession`;
        sendEmail(facilityId, manager.email, `${escalatedCount} Ticket(s) Auto-Escalated to You`, emailText).catch(err =>
          logger.error(`Failed to send auto-escalation email to agent ${manager.agent_id}: ${err.message}`)
        );
      }
    }

    return { success: true, escalated: escalatedCount };
  } catch (error) {
    logger.error(`Auto-escalation cron failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = {
  autoEscalateTickets
};
