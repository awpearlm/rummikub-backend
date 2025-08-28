// Script to check production database directly
// This connects to the same MongoDB that production uses

const mongoose = require('mongoose');
const Invitation = require('./models/Invitation');

async function checkProductionDatabase() {
  try {
    // Use the production MongoDB URI - need to get this from environment or Render
    // For now, let's use the same connection the production server uses
    const productionMongoUri = process.env.MONGODB_URI; // This should be the production URI
    
    console.log('🔍 Connecting to production MongoDB...');
    await mongoose.connect(productionMongoUri);
    console.log('✅ Connected to production database');
    
    // Get ALL invitations from production
    const allInvitations = await Invitation.find({}).sort({ sentAt: -1 });
    console.log(`📊 Found ${allInvitations.length} invitations in production database:`);
    
    allInvitations.forEach((inv, index) => {
      console.log(`${index + 1}. Email: ${inv.email}`);
      console.log(`   Status: ${inv.status}`);
      console.log(`   Sent: ${inv.sentAt}`);
      console.log(`   Expires: ${inv.expiresAt}`);
      console.log(`   ID: ${inv._id}`);
      console.log('   ---');
    });
    
    // Check specifically for the one showing in UI
    const jillianInvitation = await Invitation.findOne({ email: 'jillianpearlman@gmail.com' });
    if (jillianInvitation) {
      console.log('🎯 FOUND the jillianpearlman@gmail.com invitation:');
      console.log('   Status:', jillianInvitation.status);
      console.log('   ID:', jillianInvitation._id);
      console.log('   Sent:', jillianInvitation.sentAt);
      
      if (jillianInvitation.status === 'cancelled') {
        console.log('🗑️ This invitation is cancelled and should be deleted');
        
        // Delete it
        await Invitation.findByIdAndDelete(jillianInvitation._id);
        console.log('✅ Deleted the cancelled invitation');
      }
    } else {
      console.log('❌ jillianpearlman@gmail.com invitation NOT found in database');
      console.log('   This means the UI is showing cached or stale data');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📄 Disconnected from database');
    process.exit(0);
  }
}

checkProductionDatabase();
