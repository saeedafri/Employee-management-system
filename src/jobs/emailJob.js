import { Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { emailQueue, redisConnection, redisClient } from './emailQueue.js';

const isDev = config.isDevelopment;

let transporter;

if (!isDev) {
  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    auth: config.smtpUser && config.smtpPass ? {
      user: config.smtpUser,
      pass: config.smtpPass,
    } : undefined,
  });
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  const masked = local.substring(0, 2) + '*'.repeat(Math.max(0, local.length - 4)) + local.substring(local.length - 2);
  return `${masked}@${domain}`;
}

async function sendEmail(job) {
  const { to, subject, template, data } = job.data;

  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(`[EMAIL_MOCK] Would send email to: ${maskEmail(to)}`);
    // eslint-disable-next-line no-console
    console.log(`[EMAIL_MOCK] Subject: ${subject}`);
    // eslint-disable-next-line no-console
    console.log(`[EMAIL_MOCK] Template: ${template}`);
    return { success: true, devMode: true };
  }

  try {
    const html = renderEmailTemplate(template, data);
    await transporter.sendMail({
      from: config.smtpFrom,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[EMAIL_ERROR] Failed to send email to ${to}:`, error.message);
    throw error;
  }
}

function renderEmailTemplate(template, data) {
  const templates = {
    password_reset: (d) => `
      <html>
        <body>
          <h2>Reset Your Password</h2>
          <p>Click the link below to reset your password. This link expires in ${d.expiresInMinutes} minutes.</p>
          <a href="${d.resetUrl}">Reset Password</a>
          <p>If you didn't request a password reset, you can ignore this email.</p>
        </body>
      </html>
    `,
  };

  const templateFn = templates[template];
  if (!templateFn) {
    throw new Error(`Unknown email template: ${template}`);
  }

  return templateFn(data);
}

let emailWorker;

if (config.isTesting) {
  emailWorker = null;
} else {
  emailWorker = new Worker('email', async (job) => {
    return sendEmail(job);
  }, {
    connection: redisConnection,
    concurrency: 5,
  });

  emailWorker.on('completed', (job) => {
    // eslint-disable-next-line no-console
    console.log(`[EMAIL] Job ${job.id} completed`);
  });

  emailWorker.on('failed', (job, error) => {
    // eslint-disable-next-line no-console
    console.error(`[EMAIL] Job ${job.id} failed:`, error.message);
  });
}

export async function enqueuePasswordResetEmail(to, resetToken, expiresInMinutes) {
  if (config.isTesting) {
    return { success: true, devMode: true };
  }

  const resetUrl = `${config.frontendResetPasswordUrl}?token=${resetToken}`;

  await emailQueue.add('password_reset', {
    to,
    subject: 'Reset Your Password',
    template: 'password_reset',
    data: {
      resetUrl,
      expiresInMinutes,
    },
  }, {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}
