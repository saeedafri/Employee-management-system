import { Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { emailQueue, redisConnection } from './emailQueue.js';

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

async function sendEmail(job) {
  const { to, subject, template, data } = job.data;

  if (isDev) {
    return { success: true, devMode: true };
  }

  const html = renderEmailTemplate(template, data);
  await transporter.sendMail({
    from: config.smtpFrom,
    to,
    subject,
    html,
  });
  return { success: true };
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

  emailWorker.on('completed', () => {
    // Job completed successfully
  });

  emailWorker.on('failed', () => {
    // Job failed
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
