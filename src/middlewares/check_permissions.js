
module.exports = (module, action) => {
    return async (request, reply) => {
        const user = request.user; // assuming JWT decoded user is attached here

        const hasPermission = user?.permissions?.[module]?.[action];

        console.log(`Checking permission: ${module}.${action} -> ${hasPermission}`);

        if (!hasPermission) {
            return reply.code(403).send({ error: "Access denied. You do not have permission." });
        }
    };
};


// const checkPermission = (resourceType, operation) => {
//     return async (request, reply, next) => {
//       try {
//         // Get user from JWT authentication
//         const user = request.user;
        
//         // If no user found, deny access
//         if (!user) {
//           return reply.code(401).send({ error: 'Authentication required' });
//         }
        
//         // Check if user has the required permission
//         if (!user.permissions || 
//             !user.permissions[resourceType] || 
//             !user.permissions[resourceType][operation]) {
//           return reply.code(403).send({ 
//             error: `You don't have permission to ${operation} ${resourceType}` 
//           });
//         }
        
//         // User has permission, continue to the route handler
//         return next();
//       } catch (err) {
//         console.error('Permission check error:', err);
//         return reply.code(500).send({ error: 'Server error during permission check' });
//       }
//     };
//   };
  
// module.exports = { checkPermission };



