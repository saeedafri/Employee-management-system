#!/usr/bin/env node

import nodemailer from 'nodemailer';
import { config } from '../src/config/index.js';

const args = process.argv.slice(2);
const emailIndex = args.indexOf('--to');
if (emailIndex === -1) {
  console.error('Usage: npm run email:test -- --to your-email@example.com');
  process.exit(1);
}

const recipientEmail = args[emailIndex + 1];
if (!recipientEmail) {
  console.error('Error: Email address is required after --to flag');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(recipientEmail)) {
  console.error('Error: Invalid email format');
  process.exit(1);
}

async function sendTestEmail() {
  try {
    if (config.emailProvider === 'mock') {
      console.log('[EMAIL_MOCK] Test email would be sent to:', maskEmail(recipientEmail));
      console.log('[EMAIL_MOCK] Subject: EMS Email Test');
      console.log('[EMAIL_MOCK] Body: This is a safe test email from EMS backend.');
      console.log('\nEmail test successful (mock mode)');
      return;
    }

    if (config.emailProvider !== 'smtp') {
      console.error(`Error: Unsupported email provider: ${config.emailProvider}`);
      process.exit(1);
    }

    // SMTP Provider
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      auth: config.smtpUser && config.smtpPass ? {
        user: config.smtpUser,
        pass: config.smtpPass,
      } : undefined,
    });

    // Test connection first
    await transporter.verify();

    const result = await transporter.sendMail({
      from: config.smtpFrom,
      to: recipientEmail,
      subject: 'EMS Email Test',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; margin: 20px;">
            <h2>EMS Email Test</h2>
            <p>This is a safe test email from EMS backend.</p>
            <p>Sent at: ${new Date().toISOString()}</p>
          </body>
        </html>
      `,
    });

    console.log(`Email test sent successfully to ${maskEmail(recipientEmail)}`);
    if (result.messageId) {
      console.log(`Message ID: ${result.messageId}`);
    }
  } catch (error) {
    console.error('Email test failed. Check SMTP configuration.');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}${'*'.repeat(local.length - 1)}@${domain}`;
  }
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

sendTestEmail();
