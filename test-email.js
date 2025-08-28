const emailService = require('./services/emailService');

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');
  
  // Test invitation email
  console.log('📧 Testing invitation email...');
  const invitationResult = await emailService.sendInvitationEmail(
    'test@example.com',
    'John Doe',
    'https://jkube.netlify.app/signup.html?token=test123',
    'Hey! Come play some Rummikub with me!'
  );
  
  console.log('Invitation Result:', invitationResult);
  
  // Test welcome email
  console.log('\n📧 Testing welcome email...');
  const welcomeResult = await emailService.sendWelcomeEmail(
    'test@example.com',
    'TestUser'
  );
  
  console.log('Welcome Result:', welcomeResult);
  
  console.log('\n✅ Email service test completed!');
  process.exit(0);
}

testEmailService().catch(error => {
  console.error('❌ Email service test failed:', error);
  process.exit(1);
});
