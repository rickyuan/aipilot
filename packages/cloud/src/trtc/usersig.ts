/**
 * TRTC UserSig generation via HMAC-SHA256.
 *
 * UserSig is generated server-side ONLY. Never on the client.
 * SDKAppID and SecretKey come from environment variables.
 * Default expiry: 24h (86400s).
 */

import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';

/**
 * Generates a TRTC UserSig for the given user.
 * @param sdkAppId - TRTC SDKAppID
 * @param secretKey - TRTC SecretKey
 * @param userId - The TRTC userId
 * @param expire - Signature expiry in seconds (default: 86400 = 24h)
 * @returns The generated UserSig string
 */
export function generateUserSig(
  sdkAppId: number,
  secretKey: string,
  userId: string,
  expire = 86400,
): string {
  const currTime = Math.floor(Date.now() / 1000);

  const sigDoc: Record<string, string | number> = {
    'TLS.ver': '2.0',
    'TLS.identifier': userId,
    'TLS.sdkappid': sdkAppId,
    'TLS.expire': expire,
    'TLS.time': currTime,
  };

  const contentToSign = [
    `TLS.identifier:${userId}`,
    `TLS.sdkappid:${String(sdkAppId)}`,
    `TLS.time:${String(currTime)}`,
    `TLS.expire:${String(expire)}`,
  ].join('\n') + '\n';

  const hmac = createHmac('sha256', secretKey)
    .update(contentToSign)
    .digest('base64');

  sigDoc['TLS.sig'] = hmac;

  const jsonStr = JSON.stringify(sigDoc);
  const compressed = zlib.deflateSync(Buffer.from(jsonStr));

  return base64UrlEncode(compressed);
}

/**
 * Base64 URL-safe encoding (replaces +/ with *_ and removes =).
 * @param buffer - Buffer to encode
 * @returns URL-safe base64 string
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '*')
    .replace(/\//g, '-')
    .replace(/=/g, '_');
}
