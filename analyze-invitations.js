// Comprehensive invitation database analysis and cleanup script

const mongoose = require('mongoose');
const Invitation = require('./models/Invitation');

async function analyzeInvitations() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/j_kube');
    console.log('📄 Connected to database');
    
    // Get all invitations
    console.log('\n📊 Current invitation analysis:');
    const allInvitations = await Invitation.find({}).sort({ sentAt: -1 });
    
    console.log(`Total invitations: ${allInvitations.length}`);
    
    // Group by status
    const statusGroups = {};
    allInvitations.forEach(invitation => {
      if (!statusGroups[invitation.status]) {
        statusGroups[invitation.status] = [];
      }
      statusGroups[invitation.status].push(invitation);
    });
    
    console.log('\n📈 Invitations by status:');
    Object.keys(statusGroups).forEach(status => {
      console.log(`   ${status}: ${statusGroups[status].length}`);
    });
    
    // Check for expired invitations
    const now = new Date();
    const expiredInvitations = allInvitations.filter(inv => 
      inv.status === 'pending' && inv.expiresAt < now
    );
    
    console.log(`\n⏰ Expired pending invitations: ${expiredInvitations.length}`);
    
    if (expiredInvitations.length > 0) {
      console.log('   Expired invitations:');
      expiredInvitations.forEach((inv, index) => {
        console.log(`   ${index + 1}. ${inv.email} (expired: ${inv.expiresAt.toLocaleDateString()})`);
      });
      
      console.log('\n🧹 Would you like to clean up expired invitations? (They\'re automatically invalid anyway)');
      console.log('   Run: node cleanup-cancelled-invitations.js --expired');
    }
    
    // Recent invitations
    const recentInvitations = allInvitations.slice(0, 5);
    console.log('\n📋 Recent invitations:');
    recentInvitations.forEach((inv, index) => {
      const timeAgo = Math.round((now - inv.sentAt) / (1000 * 60 * 60 * 24));
      console.log(`   ${index + 1}. ${inv.email} - ${inv.status} (${timeAgo} days ago)`);
    });
    
    console.log('\n✅ Database analysis complete!');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📄 Disconnected from database');
    process.exit(0);
  }
}

async function cleanupExpiredInvitations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/j_kube');
    console.log('📄 Connected to database');
    
    const now = new Date();
    const expiredInvitations = await Invitation.find({
      status: 'pending',
      expiresAt: { $lt: now }
    });
    
    console.log(`\n🗑️ Found ${expiredInvitations.length} expired pending invitations`);
    
    if (expiredInvitations.length > 0) {
      const deleteResult = await Invitation.deleteMany({
        status: 'pending',
        expiresAt: { $lt: now }
      });
      
      console.log(`✅ Deleted ${deleteResult.deletedCount} expired invitations`);
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📄 Disconnected from database');
    process.exit(0);
  }
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.includes('--expired')) {
  console.log('🧹 Cleaning up expired invitations...');
  cleanupExpiredInvitations();
} else {
  console.log('📊 Analyzing invitation database...');
  analyzeInvitations();
}
