// Script to clean up cancelled invitations from database

const mongoose = require('mongoose');
const Invitation = require('./models/Invitation');

async function cleanupCancelledInvitations() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/j_kube');
    console.log('📄 Connected to database');
    
    // Find all cancelled invitations
    console.log('\n🔍 Finding cancelled invitations...');
    const cancelledInvitations = await Invitation.find({ status: 'cancelled' });
    
    console.log(`📊 Found ${cancelledInvitations.length} cancelled invitations:`);
    
    if (cancelledInvitations.length === 0) {
      console.log('✅ No cancelled invitations found. Database is clean!');
      return;
    }
    
    // Display what will be deleted
    cancelledInvitations.forEach((invitation, index) => {
      console.log(`   ${index + 1}. ${invitation.email} (sent: ${invitation.sentAt.toLocaleDateString()})`);
    });
    
    // Delete all cancelled invitations
    console.log('\n🗑️ Removing cancelled invitations from database...');
    const deleteResult = await Invitation.deleteMany({ status: 'cancelled' });
    
    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} cancelled invitations`);
    
    // Verify cleanup
    const remainingCancelled = await Invitation.find({ status: 'cancelled' });
    console.log(`✅ Verification: ${remainingCancelled.length} cancelled invitations remain`);
    
    // Show current invitation status
    console.log('\n📊 Current invitation statistics:');
    const stats = await Invitation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    stats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count}`);
    });
    
    console.log('\n🎉 Database cleanup completed!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📄 Disconnected from database');
    process.exit(0);
  }
}

// Only run if called directly
if (require.main === module) {
  console.log('🧹 Starting database cleanup for cancelled invitations...');
  cleanupCancelledInvitations();
}

module.exports = cleanupCancelledInvitations;
