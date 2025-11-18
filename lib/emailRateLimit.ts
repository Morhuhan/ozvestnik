import { prisma } from './db';

const USER_LIMIT_HOURS = 1;
const GLOBAL_LIMIT_HOURS = 24;

export async function checkRateLimits(
  email: string | null, 
  ipHash: string | null, 
  type: 'register' | 'password_reset'
) {
  const userLimit = parseInt(process.env.USER_EMAIL_LIMIT_PER_HOUR || '3', 10);
  const globalLimit = parseInt(process.env.GLOBAL_EMAIL_LIMIT_PER_DAY || '100', 10);

  const now = new Date();
  const userTimeAgo = new Date(now.getTime() - USER_LIMIT_HOURS * 60 * 60 * 1000);
  const globalTimeAgo = new Date(now.getTime() - GLOBAL_LIMIT_HOURS * 60 * 60 * 1000);

  const [emailAttempts, ipAttempts, globalAttempts] = await Promise.all([
    prisma.emailLog.count({
      where: {
        email: email || undefined,
        type: type,
        requestedAt: { gte: userTimeAgo },
      },
    }),
    prisma.emailLog.count({
      where: {
        ipHash: ipHash || undefined,
        type: type,
        requestedAt: { gte: userTimeAgo },
      },
    }),
    prisma.emailLog.count({
      where: {
        requestedAt: { gte: globalTimeAgo },
      },
    }),
  ]);

  if (emailAttempts >= userLimit || ipAttempts >= userLimit) {
    return { allowed: false, reason: 'user_limit' };
  }

  if (globalAttempts >= globalLimit) {
    return { allowed: false, reason: 'global_limit' };
  }

  return { allowed: true };
}

export function logEmailAttempt(
  email: string | null, 
  ipHash: string | null, 
  type: 'register' | 'password_reset'
) {
  return prisma.emailLog.create({
    data: {
      email,
      ipHash,
      type,
    },
  });
}