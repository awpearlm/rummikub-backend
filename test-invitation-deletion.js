// Test script to verify invitation deletion works properly

const Invitation = require('./models/Invitation');
const mongoose = require('mongoose');

async function testInvitationDeletion() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/j_kube');
    console.log('📄 Connected to database');
    
    // Create a test invitation
    console.log('\n🧪 Creating test invitation...');
    const testInvitation = new Invitation({
      email: 'test-deletion@example.com',
      invitedBy: new mongoose.Types.ObjectId(),
      message: 'Test deletion invitation',
      invitationToken: 'test-deletion-token-' + Date.now()
    });
    
    await testInvitation.save();
    console.log('✅ Test invitation created:', testInvitation._id);
    
    // Verify it exists
    const foundBefore = await Invitation.findById(testInvitation._id);
    console.log('✅ Invitation found before deletion:', !!foundBefore);
    
    // Delete it (simulating the admin delete endpoint)
    console.log('\n🗑️ Deleting invitation...');
    await Invitation.findByIdAndDelete(testInvitation._id);
    
    // Verify it's gone
    const foundAfter = await Invitation.findById(testInvitation._id);
    console.log('✅ Invitation found after deletion:', !!foundAfter);
    
    if (!foundAfter) {
      console.log('🎉 SUCCESS: Invitation was properly deleted from database!');
    } else {
      console.log('❌ FAILURE: Invitation still exists in database');
    }
    
    // Clean up any other test invitations
    await Invitation.deleteMany({ email: { $regex: /test-deletion/ } });
    console.log('🧹 Cleaned up test invitations');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📄 Disconnected from database');
    process.exit(0);
  }
}

// Only run if called directly
if (require.main === module) {
  testInvitationDeletion();
}

module.exports = testInvitationDeletion;
