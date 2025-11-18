import crypto from 'crypto';
import { NextRequest } from 'next/server';

function getHash(data: string): string {
  const salt = process.env.IP_HASH_SALT || 'default-salt';
  return crypto.createHash('sha256').update(data + salt).digest('hex');
}

export function getAndHashIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  
  let ip = forwarded ? forwarded.split(',')[0] : realIp;

  if (!ip) {
    return null;
  }

  return getHash(ip);
}