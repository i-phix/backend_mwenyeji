const Landmark = require("../../models/Landmark");

// DELETE /api/core/move_in/landmarks/:id — authenticated admin
// Soft-delete: sets isActive:false (frontend calls this "Deactivate").
async function deleteLandmark(request, reply) {
  try {
    const { id } = request.params;
    const landmark = await Landmark.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!landmark) return reply.code(404).send({ error: "Landmark not found" });

    return reply.code(200).send({ success: true, data: landmark });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = deleteLandmark;
