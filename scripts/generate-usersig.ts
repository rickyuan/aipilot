/**
 * TRTC UserSig generator — HMAC-SHA256.
 *
 * Usage: npx tsx scripts/generate-usersig.ts <userId> [expireSeconds]
 *
 * Requires TRTC_SDK_APP_ID and TRTC_SECRET_KEY environment variables.
 */

import { createHmac } from 'node:crypto';

function generateUserSig(sdkAppId: number, secretKey: string, userId: string, expire: number): string {
  const currTime = Math.floor(Date.now() / 1000);
  const sigDoc = {
    'TLS.ver': '2.0',
    'TLS.identifier': userId,
    'TLS.sdkappid': sdkAppId,
    'TLS.expire': expire,
    'TLS.time': currTime,
  };

  const contentToSign = `TLS.identifier:${userId}\nTLS.sdkappid:${sdkAppId}\nTLS.time:${currTime}\nTLS.expire:${expire}\n`;
  const hmac = createHmac('sha256', secretKey).update(contentToSign).digest('base64');

  const sigDocWithSig = { ...sigDoc, 'TLS.sig': hmac };
  const jsonStr = JSON.stringify(sigDocWithSig);

  return Buffer.from(jsonStr).toString('base64');
}

// CLI entry
const userId = process.argv[2];
const expire = Number(process.argv[3]) || 86400;

if (!userId) {
  console.error('Usage: npx tsx scripts/generate-usersig.ts <userId> [expireSeconds]');
  process.exit(1);
}

const sdkAppId = Number(process.env.TRTC_SDK_APP_ID);
const secretKey = process.env.TRTC_SECRET_KEY;

if (!sdkAppId || !secretKey) {
  console.error('Error: TRTC_SDK_APP_ID and TRTC_SECRET_KEY environment variables are required');
  process.exit(1);
}

const userSig = generateUserSig(sdkAppId, secretKey, userId, expire);
console.log(`UserSig for "${userId}" (expires in ${String(expire)}s):`);
console.log(userSig);
