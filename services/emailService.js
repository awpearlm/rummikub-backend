const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
    this.initPromise = this.initializeTransporter();
  }

  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initPromise;
    }
  }

  async initializeTransporter() {
    try {
      // Check for production email configuration first
      if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        // Production email configuration
        this.transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT || 587,
          secure: process.env.EMAIL_SECURE === 'true',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });
        
        console.log('📧 Email service initialized with production SMTP:', process.env.EMAIL_HOST);
      } else if (process.env.SENDGRID_API_KEY) {
        // SendGrid configuration
        this.transporter = nodemailer.createTransport({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY,
          },
        });
        
        console.log('📧 Email service initialized with SendGrid');
      } else if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
        // Mailgun configuration
        this.transporter = nodemailer.createTransport({
          host: 'smtp.mailgun.org',
          port: 587,
          secure: false,
          auth: {
            user: `postmaster@${process.env.MAILGUN_DOMAIN}`,
            pass: process.env.MAILGUN_API_KEY,
          },
        });
        
        console.log('📧 Email service initialized with Mailgun');
      } else if (process.env.NODE_ENV !== 'production') {
        // Development/testing only - use Ethereal
        const testAccount = await nodemailer.createTestAccount();
        
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        
        console.log('📧 Email service initialized with Ethereal test account (DEVELOPMENT ONLY)');
        console.log('⚠️  Test emails will be available at: https://ethereal.email');
        console.log('⚠️  This will NOT work in production - configure real email service!');
      } else {
        throw new Error('No email configuration found for production environment');
      }

      // Verify connection
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      this.isInitialized = true;
      
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      this.transporter = null;
      this.isInitialized = false;
    }
  }

  async sendInvitationEmail(email, inviterName, invitationLink, message = '') {
    await this.ensureInitialized();
    
    if (!this.transporter) {
      console.log('📧 Email service not available, invitation link logged instead');
      console.log(`Invitation for ${email}: ${invitationLink}`);
      return {
        success: false,
        error: 'Email service not configured',
        previewUrl: null
      };
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"J_kube Game" <noreply@jkube.app>',
        to: email,
        subject: `🎮 You're invited to play J_kube!`,
        html: this.generateInvitationHTML(email, inviterName, invitationLink, message),
        text: this.generateInvitationText(email, inviterName, invitationLink, message)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      const result = {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info) // Works for Ethereal
      };

      if (result.previewUrl) {
        console.log('📧 Test email sent! Preview URL:', result.previewUrl);
      } else {
        console.log('📧 Email sent successfully to:', email);
      }

      return result;
      
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return {
        success: false,
        error: error.message,
        previewUrl: null
      };
    }
  }

  generateInvitationHTML(email, inviterName, invitationLink, message = '') {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join J_kube!</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }
        .chess-icon {
            font-size: 1.2em;
            color: #ffd700;
        }
        .invitation-card {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            border-left: 5px solid #667eea;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 1.1em;
            text-align: center;
            color: #FFFFFF;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .game-preview {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background: rgba(102, 126, 234, 0.1);
            border-radius: 12px;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 25px 0;
        }
        .feature {
            text-align: center;
            padding: 15px;
            background: rgba(255, 255, 255, 0.7);
            border-radius: 8px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 0.9em;
            color: #666;
        }
        .personal-message {
            font-style: italic;
            color: #555;
            background: rgba(255, 248, 220, 0.8);
            padding: 15px;
            border-radius: 8px;
            border-left: 3px solid #ffd700;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <span class="chess-icon">♛</span> J_kube
            </div>
            <h2>You're Invited to Play!</h2>
        </div>

        <div class="invitation-card">
            <h3>🎉 ${inviterName} has invited you to join J_kube!</h3>
            <p>Get ready for hours of strategic fun with the classic tile-laying game Rummikub, complete with Jillian's rage all the way from the UK.</p>
            
            ${message ? `
            <div class="personal-message">
                <strong>Personal message from ${inviterName}:</strong><br>
                "${message}"
            </div>
            ` : ''}
        </div>

        <div class="game-preview">
            <h3>🎮 What is J_kube?</h3>
            <p>J_kube is a multiplayer online version of the beloved Rummikub game. Create sets and runs with numbered tiles, use strategic thinking, and be the first to empty your hand!</p>
        </div>

        <div style="text-align: center;">
            <a href="${invitationLink}" class="cta-button">
                🚀 Sign up for J Kube
            </a>
        </div>

        <div class="footer">
            <p>This invitation was sent to <strong>${email}</strong> by <strong>${inviterName}</strong></p>
            <p>The invitation link will expire in 7 days for security.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 0.8em;">
                🎮 J_kube - Bringing classic games to the digital world<br>
                <a href="${invitationLink.replace(/\/signup\.html.*/, '')}" style="color: #FFFFFF;">Sign up for J_kube</a>
            </p>
        </div>
    </div>
</body>
</html>`;
  }

  generateInvitationText(email, inviterName, invitationLink, message = '') {
    return `
🎮 You're Invited to Play J_kube!

${inviterName} has invited you to join J_kube, a multiplayer online Rummikub game!

${message ? `Personal message from ${inviterName}:\n"${message}"\n` : ''}

Join now: ${invitationLink}

This invitation was sent to ${email} by ${inviterName}.
The invitation link will expire in 7 days for security.

If you didn't expect this invitation, you can safely ignore this email.

---
🎮 J_kube - Bringing classic games to the digital world
Visit: ${invitationLink.replace(/\/signup\.html.*/, '')}
`;
  }

  async sendWelcomeEmail(email, username) {
    await this.ensureInitialized();
    
    if (!this.transporter) {
      console.log('📧 Welcome email not sent (email service not configured)');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"J_kube Game" <noreply@jkube.app>',
        to: email,
        subject: `🎉 Welcome to J_kube, ${username}!`,
        html: this.generateWelcomeHTML(email, username),
        text: this.generateWelcomeText(email, username)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      const result = {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info)
      };

      if (result.previewUrl) {
        console.log('📧 Welcome email sent! Preview URL:', result.previewUrl);
      } else {
        console.log('📧 Welcome email sent successfully to:', email);
      }

      return result;
      
    } catch (error) {
      console.error('❌ Welcome email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  generateWelcomeHTML(email, username) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to J_kube!</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius: 16px; padding: 40px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 2.5em; font-weight: bold; color: #667eea; margin-bottom: 10px; }
        .chess-icon { font-size: 1.2em; color: #ffd700; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 1.1em; text-align: center; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo"><span class="chess-icon">♛</span> J_kube</div>
            <h2>Welcome aboard, ${username}! 🎉</h2>
        </div>
        <p>Your account has been successfully created and you're ready to start playing!</p>
        <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://jkube.netlify.app'}" class="cta-button">🎮 Start Playing Now!</a>
        </div>
        <p style="text-align: center; margin-top: 30px; color: #666;">Happy gaming!<br>The J_kube Team</p>
    </div>
</body>
</html>`;
  }

  generateWelcomeText(email, username) {
    return `
🎉 Welcome to J_kube, ${username}!

Your account has been successfully created and you're ready to start playing!

Start playing now: ${process.env.FRONTEND_URL || 'https://jkube.netlify.app'}

Happy gaming!
The J_kube Team
`;
  }
}

module.exports = new EmailService();
