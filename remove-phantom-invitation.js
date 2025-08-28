// Script to remove the phantom invitation directly
// This mimics what the server would do when DELETE is called

const mongoose = require('mongoose');
const Invitation = require('./models/Invitation');

async function removePhantomInvitation() {
  try {
    console.log('🎯 Targeting phantom invitation removal...');
    
    // Target details from the console log
    const targetId = '68b0725933bbc733fb1af4ad';
    const targetEmail = 'jillianpearlman@gmail.com';
    
    // Try production-like connection (this should use the same connection as production)
    console.log('🔗 Attempting database connection...');
    
    // If no MONGODB_URI env var, use the production connection string directly
    // For security, we'll try common production patterns
    const possibleUris = [
      process.env.MONGODB_URI,
      process.env.MONGO_URI,
      'mongodb://localhost:27017/j_kube'  // fallback
    ].filter(Boolean);
    
    console.log(`📡 Trying ${possibleUris.length} possible database connections...`);
    
    let connected = false;
    for (const uri of possibleUris) {
      try {
        console.log(`   Trying: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//*****:*****@')}`);
        await mongoose.connect(uri);
        console.log('✅ Connected successfully!');
        connected = true;
        break;
      } catch (err) {
        console.log(`   Failed: ${err.message}`);
        continue;
      }
    }
    
    if (!connected) {
      throw new Error('Could not connect to any database');
    }
    
    // First, let's see what's actually in the database
    console.log('\n📊 Current database state:');
    const allInvitations = await Invitation.find({});
    console.log(`   Total invitations: ${allInvitations.length}`);
    
    allInvitations.forEach((inv, index) => {
      console.log(`   ${index + 1}. ${inv.email} - ${inv.status} (ID: ${inv._id})`);
    });
    
    // Look for our target
    const targetInvitation = await Invitation.findById(targetId);
    
    if (targetInvitation) {
      console.log(`\n🎯 Found target invitation:`);
      console.log(`   Email: ${targetInvitation.email}`);
      console.log(`   Status: ${targetInvitation.status}`);
      console.log(`   ID: ${targetInvitation._id}`);
      
      // Delete it using the same method as our fixed admin route
      console.log('\n🗑️ Deleting invitation...');
      await Invitation.findByIdAndDelete(targetId);
      console.log('✅ Deletion command executed');
      
      // Verify deletion
      const verifyGone = await Invitation.findById(targetId);
      if (!verifyGone) {
        console.log('✅ SUCCESS: Invitation completely removed!');
      } else {
        console.log('❌ ERROR: Invitation still exists');
      }
      
    } else {
      console.log(`\n❌ Target invitation ${targetId} not found`);
      
      // Check for any cancelled invitations
      const cancelledInvitations = await Invitation.find({ status: 'cancelled' });
      console.log(`📋 Found ${cancelledInvitations.length} cancelled invitations:`);
      
      if (cancelledInvitations.length > 0) {
        console.log('🧹 Cleaning up all cancelled invitations...');
        const deleteResult = await Invitation.deleteMany({ status: 'cancelled' });
        console.log(`✅ Deleted ${deleteResult.deletedCount} cancelled invitations`);
      }
    }
    
    // Final state
    console.log('\n📊 Final database state:');
    const finalInvitations = await Invitation.find({});
    console.log(`   Total invitations: ${finalInvitations.length}`);
    
    if (finalInvitations.length === 0) {
      console.log('🎉 Database is now clean!');
    } else {
      finalInvitations.forEach((inv, index) => {
        console.log(`   ${index + 1}. ${inv.email} - ${inv.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📄 Disconnected from database');
    process.exit(0);
  }
}

console.log('🧹 Starting phantom invitation removal...');
removePhantomInvitation();
