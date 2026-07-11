const payservedb = require('payservedb');
const path = require('path');

// Helper: recalculate all scores for a given RFQ
async function recalculateScores(rfqId) {
  const RFQResponse = payservedb.RFQResponse;
  const all = await RFQResponse.find({ rfqId }).exec();
  if (!all.length) return;

  // Calculate average prices and delivery days
  const priceAverages = all.map(r => r.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) / r.items.length);
  const deliveryDaysArr = all.map(r => r.deliveryDays);

  // Determine min/max for normalization
  const minPrice = Math.min(...priceAverages);
  const maxPrice = Math.max(...priceAverages);
  const minDelivery = Math.min(...deliveryDaysArr);
  const maxDelivery = Math.max(...deliveryDaysArr);

  // Custom scoring range
  const MIN_SCORE = 30;
  const MAX_SCORE = 95;
  const RANGE = MAX_SCORE - MIN_SCORE;

  const ops = all.map((r, idx) => {
    const rawPrice = priceAverages[idx];
    const rawDelivery = r.deliveryDays;

    // Normalize: lower price & faster delivery get higher
    const priceScore = (maxPrice === minPrice)
      ? 1
      : (maxPrice - rawPrice) / (maxPrice - minPrice);
    const deliveryScore = (maxDelivery === minDelivery)
      ? 1
      : (maxDelivery - rawDelivery) / (maxDelivery - minDelivery);

    const combined = priceScore * 0.7 + deliveryScore * 0.3;

    // Scale combined score into desired range
    let score = combined * RANGE + MIN_SCORE;
    score = Math.round(Math.max(MIN_SCORE, Math.min(MAX_SCORE, score)));

    return {
      updateOne: {
        filter: { _id: r._id },
        update: { 'evaluation.score': score, status: 'evaluated' }
      }
    };
  });

  await payservedb.RFQResponse.bulkWrite(ops);
}

// Main controller
const add_rfq_response = async (request, reply) => {
  try {
    const facilityId = request.params.facilityId || request.body.facilityId;
    let { rfqId, supplierId, items, notes, deliveryDays } = request.body;

    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch {
        return reply.code(400).send({ success: false, error: 'Invalid items JSON' });
      }
    }

    if (!facilityId || !rfqId || !supplierId || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({
        success: false,
        error: 'Facility ID, RFQ ID, Supplier ID and items array are required'
      });
    }

    let parsedDeliveryDays = parseInt(deliveryDays, 10);
    if (isNaN(parsedDeliveryDays) || parsedDeliveryDays < 1) {
      if (request.body.deliveryTimeline) {
        try {
          const timeline = typeof request.body.deliveryTimeline === 'string'
            ? JSON.parse(request.body.deliveryTimeline)
            : request.body.deliveryTimeline;
          if (timeline.daysEquivalent) {
            parsedDeliveryDays = parseInt(timeline.daysEquivalent, 10);
          }
        } catch (e) {
          console.error('Error parsing deliveryTimeline:', e);
        }
      }
      if (isNaN(parsedDeliveryDays) || parsedDeliveryDays < 1) {
        parsedDeliveryDays = 7;
      }
    }

    const rfqDetails = await payservedb.RFQDetails.findOne({ _id: rfqId, facilityId });
    if (!rfqDetails) {
      return reply.code(404).send({ success: false, error: 'RFQ not found for this facility' });
    }

    if (!rfqDetails.suppliers.some(id => id.toString() === supplierId)) {
      return reply.code(403).send({ success: false, error: 'Supplier is not invited to this RFQ' });
    }

    if (new Date() > new Date(rfqDetails.closingDate)) {
      return reply.code(400).send({ success: false, error: 'This RFQ is closed for submissions' });
    }

    const attachments = [];
    if (request.files?.length) {
      for (let i = 0; i < request.files.length; i++) {
        const file = request.files[i];
        attachments.push({
          fileName: Array.isArray(request.body.attachmentNames)
            ? request.body.attachmentNames[i]
            : request.body.attachmentNames || file.originalname,
          filePath: `uploads/${path.basename(file.path)}`,
          uploadedAt: new Date()
        });
      }
    }

    const formattedItems = items.map(item => {
      const unitPrice = parseFloat(item.unitPrice);
      const quantity = parseInt(item.quantity, 10);
      return {
        itemId: item.itemId,
        itemName: item.itemName || '',
        unitPrice,
        quantity,
        totalPrice: unitPrice * quantity,
        notes: item.notes || ''
      };
    });

    // Determine evaluation logic
    const rfqType = rfqDetails.rfqEvaluationType;
    const isAutomatic = rfqType === 'automatic';
    const finalStatus = isAutomatic ? 'evaluated' : 'submitted';

    let rfqResponse = await payservedb.RFQResponse.findOne({ rfqId, supplierId, facilityId });
    if (rfqResponse) {
      rfqResponse.items = formattedItems;
      rfqResponse.status = finalStatus;
      rfqResponse.notes = notes || '';
      rfqResponse.deliveryDays = parsedDeliveryDays;
      if (attachments.length) rfqResponse.attachments = attachments;
      rfqResponse.evaluation = { score: null, notes: '' };
      await rfqResponse.save();
    } else {
      rfqResponse = await payservedb.RFQResponse.create({
        facilityId,
        rfqId,
        supplierId,
        items: formattedItems,
        notes: notes || '',
        deliveryDays: parsedDeliveryDays,
        attachments,
        status: finalStatus,
        evaluation: { score: null, notes: '' }
      });
    }

    // Evaluate only if automatic
    if (isAutomatic) {
      await recalculateScores(rfqId);
    }

    return reply.code(200).send({
      success: true,
      message: `RFQ response ${isAutomatic ? 'submitted and evaluated' : 'submitted'} successfully`,
      data: rfqResponse
    });
  } catch (err) {
    console.error('Error in add_rfq_response:', err);
    return reply.code(500).send({ success: false, error: err.message });
  }
};

module.exports = add_rfq_response;
