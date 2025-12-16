// Resend Email Service - Integration with Replit Connectors
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

const ADMIN_EMAIL = 'hello@realtorsdashboard.com';

export async function sendWelcomeEmail(userEmail: string, firstName?: string | null) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const name = firstName || 'there';
    
    await client.emails.send({
      from: fromEmail || 'Realtors Dashboard <hello@realtorsdashboard.com>',
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
    
    console.log(`Welcome email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return false;
  }
}

export async function sendNewUserNotificationToAdmin(userEmail: string, firstName?: string | null, lastName?: string | null) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Not provided';
    const signupTime = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short'
    });
    
    await client.emails.send({
      from: fromEmail || 'Realtors Dashboard <hello@realtorsdashboard.com>',
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
    
    console.log(`Admin notification sent for new user: ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send admin notification:', error);
    return false;
  }
}
