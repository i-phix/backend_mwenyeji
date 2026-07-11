const EmailThread = require('../../../models/email_thread');

async function mark_email_read(request, reply) {
  try {
    const { email_id } = request.params;

    const email = await EmailThread.findByIdAndUpdate(
      email_id,
      { is_read: true },
      { new: true }
    ).lean();

    if (!email) {
      return reply.code(404).send({
        success: false,
        error: 'Email thread not found'
      });
    }

    return reply.code(200).send({
      success: true,
      message: 'Email marked as read',
      data: email
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to mark email as read',
      details: error.message
    });
  }
}

module.exports = mark_email_read;
