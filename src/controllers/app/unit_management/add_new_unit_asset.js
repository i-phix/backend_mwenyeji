const payservedb = require('payservedb')
const add_new_unit_asset =async (request,reply)=>{
    try 
    {
        const { name } = request.body
        const { unitId} = request.params;
        const nameExist = await payservedb.UnitAsset.findOne({name,unitId});
        
        if(nameExist){
            throw new Error('Asset Name exists.')
        }
        else
        {
            let data = new payservedb.UnitAsset({
                name,unitId
            })
            const response = data.save();
            return reply.code(200).send('New Asset has been added.')
        }
    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = add_new_unit_asset