// Resend Email Service - Direct API Integration
import { Resend } from 'resend';

const FROM_EMAIL = 'Realtors Dashboard <hello@realtorsdashboard.com>';
const ADMIN_EMAIL = 'hello@bigappledigital.nyc';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return new Resend(apiKey);
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const client = getResendClient();
    
    console.log(`[Resend] Sending email to ${options.to}: ${options.subject}`);
    
    const result = await client.emails.send({
      from: options.from || FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    
    if (result.error) {
      console.error(`[Resend] Error sending email:`, result.error);
      return false;
    }
    
    console.log(`[Resend] Email sent successfully, id: ${result.data?.id}`);
    return true;
  } catch (error) {
    console.error('[Resend] Failed to send email:', error);
    return false;
  }
}

export async function sendWelcomeEmail(userEmail: string, firstName?: string | null) {
  try {
    const client = getResendClient();
    const name = firstName || 'there';
    
    console.log(`[Resend] Attempting to send welcome email to ${userEmail} from ${FROM_EMAIL}`);
    
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: 'Welcome to Realtors Dashboard!',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="display: inline-block; background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 12px 20px; border-radius: 8px;">
      <span style="color: white; font-size: 24px; font-weight: bold;">RD</span>
    </div>
  </div>
  
  <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">Welcome to Realtors Dashboard, ${name}!</h1>
  
  <p style="color: #475569; font-size: 16px; margin-bottom: 20px;">
    You now have access to real estate market intelligence for NY, NJ & CT. Here's what you can do:
  </p>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
    <h3 style="color: #1e293b; margin-top: 0;">With your free account:</h3>
    <ul style="color: #475569; padding-left: 20px;">
      <li>Explore the Market Explorer & Opportunity Screener</li>
      <li>Unlock up to 3 property details per day</li>
      <li>View pricing comparisons and opportunity scores</li>
    </ul>
  </div>
  
  <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); border-radius: 8px; padding: 20px; margin-bottom: 24px; color: white;">
    <h3 style="margin-top: 0; color: white;">Upgrade to Pro for unlimited access:</h3>
    <ul style="padding-left: 20px;">
      <li>Unlimited property unlocks</li>
      <li>AI-powered Deal Memo generator</li>
      <li>PDF report exports</li>
      <li>Developer API access</li>
    </ul>
    <a href="https://realtorsdashboard.com/pricing" style="display: inline-block; background: white; color: #2563eb; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 12px;">View Pricing</a>
  </div>
  
  <p style="color: #475569; font-size: 16px;">
    Get started by exploring the <a href="https://realtorsdashboard.com/investment-opportunities" style="color: #2563eb;">Opportunity Screener</a> to find underpriced properties in your area.
  </p>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
  
  <p style="color: #94a3b8; font-size: 14px; text-align: center;">
    Currently covering: NY, NJ & CT | Data updated daily<br>
    <a href="https://realtorsdashboard.com" style="color: #2563eb;">Realtors Dashboard</a>
  </p>
</body>
</html>
      `,
    });
    
    console.log(`[Resend] Welcome email response:`, JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.error(`[Resend] Error sending welcome email:`, result.error);
      return false;
    }
    
    console.log(`[Resend] Welcome email sent successfully to ${userEmail}, id: ${result.data?.id}`);
    return true;
  } catch (error) {
    console.error('[Resend] Failed to send welcome email:', error);
    return false;
  }
}

export async function sendActivationEmail(userEmail: string, activationToken: string, tier: 'pro' | 'premium') {
  try {
    const client = getResendClient();
    const tierName = tier === 'premium' ? 'Premium' : 'Pro';
    const activationUrl = `https://realtorsdashboard.com/activate?token=${activationToken}`;
    
    console.log(`[Resend] Attempting to send activation email to ${userEmail}`);
    
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: `Activate your ${tierName} account - Realtors Dashboard`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="display: inline-block; background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 12px 20px; border-radius: 8px;">
      <span style="color: white; font-size: 24px; font-weight: bold;">RD</span>
    </div>
  </div>
  
  <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 16px;">Your ${tierName} subscription is ready!</h1>
  
  <p style="color: #475569; font-size: 16px; margin-bottom: 20px;">
    Thank you for subscribing to Realtors Dashboard ${tierName}. Click the button below to set your password and activate your account.
  </p>
  
  <div style="text-align: center; margin: 32px 0;">
    <a href="${activationUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Activate My Account</a>
  </div>
  
  <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
    This link expires in 1 hour. If you didn't make this purchase, please contact us immediately.
  </p>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
    <h3 style="color: #1e293b; margin-top: 0;">Your ${tierName} benefits:</h3>
    <ul style="color: #475569; padding-left: 20px;">
      ${tier === 'premium' ? `
      <li>Everything in Pro</li>
      <li>Price change alerts</li>
      <li>Portfolio dashboard</li>
      <li>Bulk CSV exports</li>
      <li>Developer API (50K calls/day)</li>
      <li>Priority support</li>
      ` : `
      <li>Unlimited property unlocks</li>
      <li>AI-powered Deal Memo generator</li>
      <li>PDF report exports</li>
      <li>Full comps data</li>
      <li>Developer API access</li>
      `}
    </ul>
  </div>
  
  <p style="color: #94a3b8; font-size: 12px;">
    If the button doesn't work, copy and paste this link into your browser:<br>
    <a href="${activationUrl}" style="color: #2563eb; word-break: break-all;">${activationUrl}</a>
  </p>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
  
  <p style="color: #94a3b8; font-size: 14px; text-align: center;">
    <a href="https://realtorsdashboard.com" style="color: #2563eb;">Realtors Dashboard</a>
  </p>
</body>
</html>
      `,
    });
    
    console.log(`[Resend] Activation email response:`, JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.error(`[Resend] Error sending activation email:`, result.error);
      return false;
    }
    
    console.log(`[Resend] Activation email sent successfully to ${userEmail}, id: ${result.data?.id}`);
    return true;
  } catch (error) {
    console.error('[Resend] Failed to send activation email:', error);
    return false;
  }
}

export async function sendNewUserNotificationToAdmin(userEmail: string, firstName?: string | null, lastName?: string | null) {
  try {
    const client = getResendClient();
    
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Not provided';
    const signupTime = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short'
    });
    
    console.log(`[Resend] Attempting to send admin notification for ${userEmail} to ${ADMIN_EMAIL}`);
    
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New User Signup: ${userEmail}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1e293b;">New User Registration</h2>
  
  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Email:</td>
        <td style="padding: 8px 0; color: #1e293b;">${userEmail}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Name:</td>
        <td style="padding: 8px 0; color: #1e293b;">${fullName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Signed up:</td>
        <td style="padding: 8px 0; color: #1e293b;">${signupTime} ET</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Plan:</td>
        <td style="padding: 8px 0; color: #1e293b;">Free</td>
      </tr>
    </table>
  </div>
  
  <p style="color: #64748b; font-size: 14px;">
    This is an automated notification from Realtors Dashboard.
  </p>
</body>
</html>
      `,
    });
    
    console.log(`[Resend] Admin notification response:`, JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.error(`[Resend] Error sending admin notification:`, result.error);
      return false;
    }
    
    console.log(`[Resend] Admin notification sent successfully for ${userEmail}, id: ${result.data?.id}`);
    return true;
  } catch (error) {
    console.error('[Resend] Failed to send admin notification:', error);
    return false;
  }
}
