// Delete specific invitation from production database
// Target: jillianpearlman@gmail.com with ID 68b0725933bbc733fb1af4ad

const mongoose = require('mongoose');
const Invitation = require('./models/Invitation');

async function deleteSpecificInvitation() {
  try {
    // This will use the same MongoDB connection that the production server uses
    // The MONGODB_URI environment variable should point to production
    console.log('🔍 Connecting to production database...');
    
    // Use the connection string from environment or default to local for testing
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/j_kube';
    console.log('📡 MongoDB URI:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//*****:*****@')); // Hide credentials
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database');
    
    // Find the specific invitation
    const targetId = '68b0725933bbc733fb1af4ad';
    const targetEmail = 'jillianpearlman@gmail.com';
    
    console.log(`🎯 Looking for invitation: ${targetEmail} (ID: ${targetId})`);
    
    const invitation = await Invitation.findById(targetId);
    
    if (invitation) {
      console.log('📧 Found invitation:');
      console.log(`   Email: ${invitation.email}`);
      console.log(`   Status: ${invitation.status}`);
      console.log(`   Sent: ${invitation.sentAt}`);
      console.log(`   ID: ${invitation._id}`);
      
      // Delete it
      console.log('🗑️ Deleting invitation...');
      await Invitation.findByIdAndDelete(targetId);
      console.log('✅ Successfully deleted invitation!');
      
      // Verify it's gone
      const checkDeleted = await Invitation.findById(targetId);
      if (!checkDeleted) {
        console.log('✅ Verification: Invitation successfully removed from database');
      } else {
        console.log('❌ ERROR: Invitation still exists after deletion attempt');
      }
      
    } else {
      console.log(`❌ Invitation with ID ${targetId} not found in database`);
      
      // Check if there's an invitation with that email but different ID
      const emailMatch = await Invitation.findOne({ email: targetEmail });
      if (emailMatch) {
        console.log(`📧 Found invitation with same email but different ID: ${emailMatch._id}`);
        console.log(`   Status: ${emailMatch.status}`);
        
        // Delete this one too
        console.log('🗑️ Deleting invitation by email...');
        await Invitation.deleteOne({ email: targetEmail });
        console.log('✅ Deleted invitation by email match');
      }
    }
    
    // Show final count
    const remainingInvitations = await Invitation.find({});
    console.log(`📊 Total invitations remaining in database: ${remainingInvitations.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📄 Disconnected from database');
    process.exit(0);
  }
}

deleteSpecificInvitation();
