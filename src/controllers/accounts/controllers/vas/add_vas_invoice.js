const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const add_quickbooks_vas_invoice = async (request, reply) => {
    try {
        const { facilityId } = request.params
        const { customerId, item, description, quantity, rate, ammount, vat, account, classType } = request.body
        const VasInvoiceModel = await getModel('VasInvoicesQuickBooks', payservedb.VasInvoicesQuickBooks.schema, facilityId)
        const data = new VasInvoiceModel({
            facilityId: facilityId,
            customerId: customerId,
            item: item,
            description: description,
            quantity: quantity,
            rate: rate,
            ammount: ammount,
            vat: vat,
            account: account,
            classType: classType
        })
        await data.save()
        return reply.code(200).send({ message: 'Vas Invoice added successfully', vasInvoice: data })
    }
    catch (err) {
        return reply.code(502).send({ error: err.message })
    }
}

module.exports = add_quickbooks_vas_invoice;