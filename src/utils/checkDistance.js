const payservedb = require('payservedb');
const mongoose = require('mongoose');

const checkDistance = async (long, lat, entryPointId) => {
    try {
        
        if (!long || !lat || !entryPointId) {
            throw new Error('Missing required parameters');
        }

        const currentLocation = {
            type: "Point",
            coordinates: [parseFloat(long), parseFloat(lat)]
        };

        const entryPoint = await payservedb.EntryExit.aggregate([
            {
                $geoNear: {
                    near: currentLocation,
                    distanceField: "distance", // Output field for the distance
                    spherical: true,
                    query: { _id: new mongoose.Types.ObjectId(entryPointId) } // Corrected: Use 'new' with ObjectId
                }
            }
        ]);

        if (entryPoint.length === 0) {
            throw new Error('Entry point not found');
        }

        const radius = entryPoint[0].range;
        const distance = entryPoint[0].distance; // Distance in meters

        return distance <= radius;
    } catch (err) {
        console.log(err.message); // Log the error for debugging
        return false; // Return false in case of an error
    }
};

module.exports = checkDistance;
