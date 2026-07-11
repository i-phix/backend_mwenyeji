const payservedb = require('payservedb');

async function createTestAgentsWithUsers() {
  try {
    console.log('Creating test agents with corresponding user records...');

    const testAgents = [
      {
        firstName: 'Jane',
        lastName: 'TeamLeader',
        email: 'jane.teamleader@payserve.com',
        phone: '+254701234567',
        role: 'team_leader',
        team_id: 'team_001'
      },
      {
        firstName: 'Mike',
        lastName: 'Supervisor',
        email: 'mike.supervisor@payserve.com',
        phone: '+254702234567',
        role: 'supervisor',
        team_id: 'team_001'
      },
      {
        firstName: 'Sarah',
        lastName: 'Manager',
        email: 'sarah.manager@payserve.com',
        phone: '+254703234567',
        role: 'manager',
        team_id: null
      },
      {
        firstName: 'Tom',
        lastName: 'Technician',
        email: 'tom.technician@payserve.com',
        phone: '+254704234567',
        role: 'technician',
        team_id: 'team_tech'
      }
    ];

    for (const agentData of testAgents) {
      // Check if user already exists
      const existingUser = await payservedb.User.findOne({ email: agentData.email });
      const existingAgent = await payservedb.Agent.findOne({ email: agentData.email });

      if (existingUser || existingAgent) {
        console.log(`Skipping ${agentData.email} - already exists`);
        continue;
      }

      // Generate temporary password
      const bcrypt = require('bcryptjs');
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Create user record first
      const userRecord = {
        fullName: `${agentData.firstName} ${agentData.lastName}`,
        email: agentData.email,
        phoneNumber: agentData.phone,
        type: 'Customer_Support', // Correct type for agent login
        role: 'user', // Standard user role
        password: hashedPassword
      };

      const newUser = new payservedb.User(userRecord);
      const savedUser = await newUser.save();

      // Generate agent ID using schema method if available, otherwise generate manually
      let agentId;
      if (payservedb.Agent.generateAgentId) {
        agentId = payservedb.Agent.generateAgentId();
      } else {
        const agentCount = await payservedb.Agent.countDocuments();
        agentId = `PS25${String(agentCount + 1000).padStart(4, '0')}`;
      }

      // Create agent record
      const agentRecord = {
        agent_id: agentId,
        user_id: savedUser._id, // Link to user record
        name: `${agentData.firstName} ${agentData.lastName}`,
        email: agentData.email,
        phone: agentData.phone,
        role: agentData.role,
        department: 'Customer Support',
        status: 'active',
        team_id: agentData.team_id,
        performance_metrics: {
          total_tickets_handled: 0,
          customer_satisfaction_score: 0
        }
      };

      const newAgent = new payservedb.Agent(agentRecord);
      const savedAgent = await newAgent.save();

      console.log(`✅ Created: ${savedAgent.name} (${savedAgent.agent_id}) - ${savedAgent.role}`);
      console.log(`   User ID: ${savedUser._id}`);
      console.log(`   Temp Password: ${tempPassword}`);
      console.log('');
    }

    // Display all agents
    console.log('📋 All agents in database:');
    const allAgents = await payservedb.Agent.find({})
      .populate('user_id', 'fullName email phoneNumber type')
      .select('agent_id name email role team_id status user_id');

    allAgents.forEach(agent => {
      console.log(`- ${agent.name} (${agent.agent_id}) - ${agent.role} | Team: ${agent.team_id || 'None'} | Status: ${agent.status}`);
      if (agent.user_id) {
        console.log(`  User: ${agent.user_id.email} (${agent.user_id.type})`);
      }
    });

    console.log('\n✅ Test agents created successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating test agents:', error);
    process.exit(1);
  }
}

// Run the function
createTestAgentsWithUsers();