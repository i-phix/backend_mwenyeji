const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const delete_reminder = async (request, reply) => {
  try {
    const { facilityId, reminderId } = request.params;
    console.log('Deleting reminder:', { facilityId, reminderId });

    // Validate parameters
    if (!reminderId || !facilityId) {
      return reply.code(400).send({
        success: false,
        error: 'Missing reminderId or facilityId'
      });
    }

    const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, facilityId);

    // Use findByIdAndDelete for consistency with penalty deletion
    const deletedReminder = await reminderModel.findByIdAndDelete(reminderId);

    if (!deletedReminder) {
      return reply.code(404).send({
        success: false,
        error: 'Reminder not found'
      });
    }

    return reply.code(200).send({
      success: true,
      message: 'Reminder deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting reminder:', err);
    return reply.code(502).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = delete_reminder;