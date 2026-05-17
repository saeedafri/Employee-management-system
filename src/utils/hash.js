import { hash, verify } from 'argon2';
import { createHash } from 'crypto';

export async function hashPassword(password) {
  return hash(password, {
    type: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(password, hash) {
  return verify(hash, password);
}

export function hashSHA256(data) {
  return createHash('sha256').update(data).digest('hex');
}
