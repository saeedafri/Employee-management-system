import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { config } from '../config/index.js';

const secret = new TextEncoder().encode(config.jwtSecret);

export async function createAccessToken(payload, expiresIn = config.accessTokenExpiresIn) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(token) {
  try {
    const verified = await jwtVerify(token, secret);
    return verified.payload;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

export function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 256-bit (32-byte) cryptographically random token — use for invite links
export function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}
