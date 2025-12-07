"use strict";

const nodemailer = require('nodemailer');
const config = require('./config.json');

// Replace ${VAR_NAME} placeholders with environment variables
function replaceEnvVars(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    return process.env[varName] || match;
  });
}

// Get current environment (default to development)
const env = process.env.NODE_ENV || 'development';
let emailConfig = config[env]?.email;

// Replace environment variables in email config
if (emailConfig) {
  emailConfig = {
    service: replaceEnvVars(emailConfig.service),
    user: replaceEnvVars(emailConfig.user),
    password: replaceEnvVars(emailConfig.password),
    from: replaceEnvVars(emailConfig.from)
  };
  console.log('Email config loaded:', { 
    service: emailConfig.service, 
    user: emailConfig.user,
    hasPassword: !!emailConfig.password 
  });
}

let transporter = null;

// Initialize email transporter
function initializeTransporter() {
  if (!emailConfig || !emailConfig.user || !emailConfig.password) {
    console.warn('Email configuration not found or incomplete. Email sending will be disabled.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      service: emailConfig.service || 'gmail',
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password
      },
      // Add connection timeout settings
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000
    });
    
    console.log('Email transporter initialized successfully');
    return transporter;
  } catch (error) {
    console.error('Failed to initialize email transporter:', error);
    return null;
  }
}

// Send reservation confirmation email
async function sendReservationEmail(recipientEmail, reservationData) {
  if (!transporter) {
    transporter = initializeTransporter();
  }

  if (!transporter) {
    console.log('Email not sent: Transporter not configured');
    return { success: false, message: 'Email service not configured' };
  }

  const { reservationCode, studentName, items, cancelWindowExpires } = reservationData;

  // Format items list for email
  const itemsList = items.map(item => 
    `• ${item.productName}${item.variantName ? ` (${item.variantName})` : ''} - Quantity: ${item.quantity}`
  ).join('\n');

  // Calculate cancel window expiry time
  const expiryDate = new Date(cancelWindowExpires);
  const expiryTime = expiryDate.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const mailOptions = {
    from: emailConfig.from || emailConfig.user,
    to: recipientEmail,
    subject: `Reservation Confirmed - ${reservationCode}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2a6b52 0%, #1e4d3c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
          .reservation-code { background: #fff; border: 2px dashed #2a6b52; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .reservation-code h2 { margin: 0; color: #2a6b52; font-size: 32px; letter-spacing: 2px; }
          .items-list { background: #fff; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2a6b52; }
          .warning-box { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .warning-box strong { color: #856404; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
          .button { display: inline-block; background: #2a6b52; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎁 GCCI Giftstore</h1>
            <p>Reservation Confirmation</p>
          </div>
          <div class="content">
            <p>Hi <strong>${studentName}</strong>,</p>
            <p>Your reservation has been successfully created!</p>
            
            <div class="reservation-code">
              <p style="margin: 0; font-size: 14px; color: #666;">Your Reservation Code</p>
              <h2>${reservationCode}</h2>
            </div>

            <div class="warning-box">
              <strong>⏰ Important:</strong> You have <strong>10 minutes</strong> to cancel this reservation if needed. 
              The cancellation window expires on <strong>${expiryTime}</strong>.
            </div>

            <div class="items-list">
              <h3 style="margin-top: 0; color: #2a6b52;">Reserved Items:</h3>
              <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; margin: 0;">${itemsList}</pre>
            </div>

            <p><strong>What's Next?</strong></p>
            <ul>
              <li>Save your reservation code for claiming your items</li>
              <li>You can cancel within 10 minutes using the "My Reservations" button on our website</li>
              <li>After the cancellation window, your reservation will be processed</li>
              <li>Present your reservation code when picking up your items</li>
            </ul>

            <p style="margin-top: 30px;">If you have any questions, please contact us at the GCCI Giftstore.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from GCCI Giftstore System</p>
            <p>&copy; ${new Date().getFullYear()} GCCI Giftstore. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
GCCI Giftstore - Reservation Confirmation

Hi ${studentName},

Your reservation has been successfully created!

RESERVATION CODE: ${reservationCode}

⏰ IMPORTANT: You have 10 minutes to cancel this reservation if needed.
The cancellation window expires on ${expiryTime}.

RESERVED ITEMS:
${itemsList}

WHAT'S NEXT:
- Save your reservation code for claiming your items
- You can cancel within 10 minutes using the "My Reservations" button on our website
- After the cancellation window, your reservation will be processed
- Present your reservation code when picking up your items

If you have any questions, please contact us at the GCCI Giftstore.

---
This is an automated message from GCCI Giftstore System
© ${new Date().getFullYear()} GCCI Giftstore. All rights reserved.
    `
  };

  try {
    // Set timeout for email sending
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email sending timeout after 15 seconds')), 15000)
    );
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error.message);
    // Don't throw error, just log and return failure
    return { success: false, error: error.message };
  }
}

// Send cancellation confirmation email
async function sendCancellationEmail(recipientEmail, cancellationData) {
  if (!transporter) {
    transporter = initializeTransporter();
  }

  if (!transporter) {
    console.log('Email not sent: Transporter not configured');
    return { success: false, message: 'Email service not configured' };
  }

  const { reservationCode, studentName, items } = cancellationData;

  const itemsList = items.map(item => 
    `• ${item.productName}${item.variantName ? ` (${item.variantName})` : ''} - Quantity: ${item.quantity}`
  ).join('\n');

  const mailOptions = {
    from: emailConfig.from || emailConfig.user,
    to: recipientEmail,
    subject: `Reservation Cancelled - ${reservationCode}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc3545 0%, #a71d2a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
          .reservation-code { background: #fff; border: 2px dashed #dc3545; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .reservation-code h2 { margin: 0; color: #dc3545; font-size: 32px; letter-spacing: 2px; }
          .items-list { background: #fff; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #dc3545; }
          .info-box { background: #d1ecf1; border: 1px solid #0c5460; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎁 GCCI Giftstore</h1>
            <p>Reservation Cancelled</p>
          </div>
          <div class="content">
            <p>Hi <strong>${studentName}</strong>,</p>
            <p>Your reservation has been successfully cancelled.</p>
            
            <div class="reservation-code">
              <p style="margin: 0; font-size: 14px; color: #666;">Cancelled Reservation Code</p>
              <h2>${reservationCode}</h2>
            </div>

            <div class="items-list">
              <h3 style="margin-top: 0; color: #dc3545;">Cancelled Items:</h3>
              <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; margin: 0;">${itemsList}</pre>
            </div>

            <div class="info-box">
              <strong>ℹ️ What happened?</strong>
              <p style="margin: 5px 0 0 0;">The items have been returned to inventory and are now available for other customers.</p>
            </div>

            <p>You can create a new reservation anytime by visiting our giftstore catalog.</p>

            <p style="margin-top: 30px;">If you have any questions, please contact us at the GCCI Giftstore.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from GCCI Giftstore System</p>
            <p>&copy; ${new Date().getFullYear()} GCCI Giftstore. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
GCCI Giftstore - Reservation Cancelled

Hi ${studentName},

Your reservation has been successfully cancelled.

CANCELLED RESERVATION CODE: ${reservationCode}

CANCELLED ITEMS:
${itemsList}

ℹ️ WHAT HAPPENED?
The items have been returned to inventory and are now available for other customers.

You can create a new reservation anytime by visiting our giftstore catalog.

If you have any questions, please contact us at the GCCI Giftstore.

---
This is an automated message from GCCI Giftstore System
© ${new Date().getFullYear()} GCCI Giftstore. All rights reserved.
    `
  };

  try {
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email sending timeout after 15 seconds')), 15000)
    );
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log('Cancellation email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send cancellation email:', error.message);
    return { success: false, error: error.message };
  }
}

// Send claim deadline notification email
async function sendClaimDeadlineEmail(recipientEmail, deadlineData) {
  if (!transporter) {
    transporter = initializeTransporter();
  }

  if (!transporter) {
    console.log('Email not sent: Transporter not configured');
    return { success: false, message: 'Email service not configured' };
  }

  const { reservationCode, studentName, items, claimDeadline } = deadlineData;

  const itemsList = items.map(item => 
    `• ${item.productName}${item.variantName ? ` (${item.variantName})` : ''} - Quantity: ${item.quantity}`
  ).join('\n');

  const deadlineDate = new Date(claimDeadline);
  const deadlineFormatted = deadlineDate.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const mailOptions = {
    from: emailConfig.from || emailConfig.user,
    to: recipientEmail,
    subject: `Ready to Claim - ${reservationCode}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2a6b52 0%, #1e4d3c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
          .reservation-code { background: #fff; border: 2px dashed #2a6b52; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .reservation-code h2 { margin: 0; color: #2a6b52; font-size: 32px; letter-spacing: 2px; }
          .items-list { background: #fff; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2a6b52; }
          .warning-box { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .warning-box strong { color: #856404; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎁 GCCI Giftstore</h1>
            <p>Your Items Are Ready to Claim!</p>
          </div>
          <div class="content">
            <p>Hi <strong>${studentName}</strong>,</p>
            <p>The cancellation window for your reservation has ended. Your items are now ready to be claimed!</p>
            
            <div class="reservation-code">
              <p style="margin: 0; font-size: 14px; color: #666;">Your Reservation Code</p>
              <h2>${reservationCode}</h2>
            </div>

            <div class="warning-box">
              <strong>⏰ Important - Claim Deadline:</strong> You have <strong>2 business days</strong> to claim your items.
              <br>Your reservation will expire on <strong>${deadlineFormatted}</strong>.
              <br><em>Note: Weekends (Saturday & Sunday) are not counted.</em>
            </div>

            <div class="items-list">
              <h3 style="margin-top: 0; color: #2a6b52;">Items to Claim:</h3>
              <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; margin: 0;">${itemsList}</pre>
            </div>

            <p><strong>How to Claim:</strong></p>
            <ul>
              <li>Visit the GCCI Giftstore during business hours</li>
              <li>Present your reservation code: <strong>${reservationCode}</strong></li>
              <li>Complete payment and collect your items</li>
            </ul>

            <p><strong>⚠️ If you don't claim by the deadline:</strong></p>
            <ul>
              <li>Your reservation will be automatically cancelled</li>
              <li>Items will be returned to inventory</li>
              <li>You'll need to create a new reservation</li>
            </ul>

            <p style="margin-top: 30px;">If you have any questions, please contact us at the GCCI Giftstore.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from GCCI Giftstore System</p>
            <p>&copy; ${new Date().getFullYear()} GCCI Giftstore. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
GCCI Giftstore - Your Items Are Ready to Claim!

Hi ${studentName},

The cancellation window for your reservation has ended. Your items are now ready to be claimed!

RESERVATION CODE: ${reservationCode}

⏰ IMPORTANT - CLAIM DEADLINE:
You have 2 business days to claim your items.
Your reservation will expire on ${deadlineFormatted}.
Note: Weekends (Saturday & Sunday) are not counted.

ITEMS TO CLAIM:
${itemsList}

HOW TO CLAIM:
- Visit the GCCI Giftstore during business hours
- Present your reservation code: ${reservationCode}
- Complete payment and collect your items

⚠️ IF YOU DON'T CLAIM BY THE DEADLINE:
- Your reservation will be automatically cancelled
- Items will be returned to inventory
- You'll need to create a new reservation

If you have any questions, please contact us at the GCCI Giftstore.

---
This is an automated message from GCCI Giftstore System
© ${new Date().getFullYear()} GCCI Giftstore. All rights reserved.
    `
  };

  try {
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email sending timeout after 15 seconds')), 15000)
    );
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log('Claim deadline email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send claim deadline email:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initializeTransporter,
  sendReservationEmail,
  sendCancellationEmail,
  sendClaimDeadlineEmail
};
