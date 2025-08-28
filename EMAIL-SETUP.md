# Email Configuration Guide for J_kube

## Problem Solved
This guide explains how to set up **real email sending** for the J_kube invitation system in production. Without this, users won't receive invitation emails.

## Quick Setup Options

### Option 1: Gmail SMTP (Easiest - 5 minutes)
**Best for**: Personal projects, small teams

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Copy the 16-character password

3. **Set Environment Variables** on your hosting platform (Render/Heroku):
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=your_16_character_app_password
EMAIL_FROM="J_kube Game" <youremail@gmail.com>
NODE_ENV=production
```

### Option 2: SendGrid (Best for Production)
**Best for**: Production apps, better deliverability

1. **Sign up** at [SendGrid](https://sendgrid.com) (free: 100 emails/day)
2. **Create API Key**:
   - Dashboard → Settings → API Keys
   - Create API Key with "Full Access"
3. **Verify Sender Email**:
   - Dashboard → Settings → Sender Authentication
   - Verify your email address

4. **Set Environment Variables**:
```bash
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM="J_kube Game" <your_verified_email@domain.com>
NODE_ENV=production
```

### Option 3: Mailgun (Alternative)
**Best for**: High volume, good free tier

1. **Sign up** at [Mailgun](https://mailgun.com) (free: 5,000 emails/month)
2. **Get Domain & API Key** from dashboard
3. **Set Environment Variables**:
```bash
MAILGUN_DOMAIN=your_domain.mailgun.org
MAILGUN_API_KEY=your_mailgun_api_key
EMAIL_FROM="J_kube Game" <noreply@your_domain.mailgun.org>
NODE_ENV=production
```

## Setting Environment Variables on Render

1. Go to your Render dashboard
2. Select your J_kube service
3. Go to "Environment" tab
4. Add the variables for your chosen email service
5. Deploy

## Testing Email Setup

After configuring environment variables:

1. **Check server logs** for email initialization:
   ```
   📧 Email service initialized with Gmail/SendGrid/Mailgun
   ✅ Email service connection verified
   ```

2. **Test invitation**:
   - Go to admin dashboard
   - Send invitation to your own email
   - Check if you receive the email

3. **Common Issues**:
   - Gmail: Make sure 2FA is enabled and you're using app password (not regular password)
   - SendGrid: Verify your sender email first
   - All: Check environment variables are set correctly

## Email Templates Included

The system includes beautiful HTML email templates with:
- ✨ Modern, responsive design
- 🎮 Game branding and visuals
- 📱 Mobile-friendly layout
- 🔗 Clear call-to-action buttons
- 💬 Personal message support

## Development vs Production

- **Development**: Uses Ethereal (fake emails) for testing
- **Production**: Requires real email service configuration
- **Fallback**: If email fails, invitation links are logged to console

## Security Notes

- Never commit email passwords to git
- Use environment variables only
- Gmail app passwords are safer than regular passwords
- SendGrid/Mailgun are more secure than SMTP

## Current Status

✅ Email service implemented
✅ HTML templates created  
✅ Multiple provider support
✅ Production-ready configuration
⚠️ **Next Step**: Configure email service environment variables on Render
