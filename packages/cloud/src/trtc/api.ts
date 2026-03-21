/**
 * TRTC server-side API wrapper.
 *
 * Handles REST API calls to TRTC for Conversational AI bot lifecycle.
 * Endpoint: trtc.tencentcloudapi.com (region: ap-singapore)
 */

import { createHmac, createHash } from 'node:crypto';
import type { AIBotConfig } from '@deskpilot/shared';
import { config } from '../config.js';

const TRTC_API_HOST = 'trtc.tencentcloudapi.com';
const TRTC_REGION = 'ap-singapore';

/**
 * Signs a request using Tencent Cloud TC3-HMAC-SHA256 signature.
 * @param action - The API action name
 * @param payload - The JSON payload string
 * @param timestamp - Unix timestamp
 * @returns Authorization header string
 */
function signRequest(action: string, payload: string, timestamp: number): string {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const service = 'trtc';
  const credentialScope = `${date}/${service}/tc3_request`;

  // Step 1: Canonical request
  const hashedPayload = createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json; charset=utf-8`,
    `host:${TRTC_API_HOST}`,
    '',
    'content-type;host',
    hashedPayload,
  ].join('\n');

  // Step 2: String to sign
  const hashedCanonical = createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    hashedCanonical,
  ].join('\n');

  // Step 3: Calculate signature
  const secretDate = createHmac('sha256', `TC3${config.TRTC_SECRET_KEY}`).update(date).digest();
  const secretService = createHmac('sha256', secretDate).update(service).digest();
  const secretSigning = createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  return `TC3-HMAC-SHA256 Credential=${String(config.TRTC_SDK_APP_ID)}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`;
}

/**
 * Makes a signed request to the TRTC API.
 * @param action - The API action name
 * @param params - Request parameters
 * @returns The API response data
 */
async function trtcApiRequest(action: string, params: Record<string, unknown>): Promise<unknown> {
  const payload = JSON.stringify(params);
  const timestamp = Math.floor(Date.now() / 1000);
  const authorization = signRequest(action, payload, timestamp);

  const response = await fetch(`https://${TRTC_API_HOST}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Host': TRTC_API_HOST,
      'X-TC-Action': action,
      'X-TC-Version': '2019-07-22',
      'X-TC-Region': TRTC_REGION,
      'X-TC-Timestamp': String(timestamp),
      'Authorization': authorization,
    },
    body: payload,
  });

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`TRTC API error: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Creates a Conversational AI bot and joins it to the specified room.
 * @param botConfig - Bot configuration
 * @returns The conversation/task ID from TRTC
 */
export async function createAIConversation(botConfig: AIBotConfig): Promise<string> {
  const params = {
    SdkAppId: config.TRTC_SDK_APP_ID,
    RoomId: botConfig.roomId,
    AgentConfig: {
      UserId: botConfig.botUserId,
      UserSig: botConfig.botUserSig,
    },
  };

  const result = await trtcApiRequest('StartAIConversation', params) as {
    Response?: { TaskId?: string };
  };

  const taskId = result.Response?.TaskId;
  if (!taskId) {
    throw new Error('TRTC StartAIConversation did not return a TaskId');
  }

  return taskId;
}

/**
 * Destroys a Conversational AI bot.
 * @param taskId - The conversation/task ID returned from createAIConversation
 */
export async function destroyAIConversation(taskId: string): Promise<void> {
  await trtcApiRequest('StopAIConversation', { TaskId: taskId });
}
