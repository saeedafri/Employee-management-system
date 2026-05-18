#!/usr/bin/env node

import nodemailer from 'nodemailer';
import { config } from '../src/config/index.js';

async function testEmailDirect() {
  try {
    console.log('Testing SMTP connection...');
    console.log(`SMTP Host: ${config.smtpHost}`);
    console.log(`SMTP Port: ${config.smtpPort}`);
    console.log(`From: ${config.smtpFrom}`);

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: false, // TLS
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    // Verify connection
    const verified = await transporter.verify();
    console.log(`✅ SMTP Connection verified: ${verified}`);

    // Send test email
    const result = await transporter.sendMail({
      from: config.smtpFrom,
      to: 'mohammadsaeedafri9@gmail.com',
      subject: 'EMS OTP Email Test - Direct Send',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; margin: 20px;">
            <h2>Email System Test</h2>
            <p>This is a direct SMTP test email from EMS backend OTP system.</p>
            <p><strong>Test Code:</strong> 123456</p>
            <p>Expires in: 10 minutes</p>
            <p style="color: #666; font-size: 12px;">
              Sent at: ${new Date().toISOString()}
            </p>
          </body>
        </html>
      `,
    });

    console.log(`\n✅ Email sent successfully!`);
    console.log(`Message ID: ${result.messageId}`);
    console.log(`Response: ${result.response}`);
    console.log(`\nEmail has been sent to: mohammadsaeedafri9@gmail.com`);
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    process.exit(1);
  }
}

testEmailDirect();
