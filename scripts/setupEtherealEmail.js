#!/usr/bin/env node

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

async function setupEtherealAccount() {
  console.log('Creating free Ethereal Email test account...\n');

  // Create test account (free, no signup needed)
  const testAccount = await nodemailer.createTestAccount();

  console.log('✅ Ethereal Email Account Created!');
  console.log('\nAdd these to your .env file:\n');

  const envContent = `SMTP_HOST="smtp.ethereal.email"
SMTP_PORT="587"
SMTP_USER="${testAccount.user}"
SMTP_PASS="${testAccount.pass}"
SMTP_FROM="ems@ethereal.email"`;

  console.log(envContent);
  console.log('\n📧 Email Preview URL:');
  console.log(`https://ethereal.email/messages\n`);

  // Also save to env file
  const envPath = path.join(process.cwd(), '.env.ethereal');
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Saved to .env.ethereal`);
}

setupEtherealAccount().catch(console.error);
