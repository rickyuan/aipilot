/**
 * TRTC room and stream types.
 *
 * Uses trtc-sdk-v5 (not v4). String room IDs only.
 * Room ID format: dp_{userId}_{timestamp}
 * Bot userId format: bot_{roomId}
 */

export interface TRTCRoomConfig {
  /** TRTC SDKAppID */
  sdkAppId: number;
  /** String room ID (format: dp_{userId}_{timestamp}) */
  roomId: string;
  /** TRTC userId for this participant */
  userId: string;
  /** UserSig generated server-side via HMAC-SHA256 */
  userSig: string;
}

export type StreamType = 'camera' | 'screen' | 'custom';

export interface StreamConfig {
  /** Type of stream being published */
  streamType: StreamType;
  /** Encoder configuration preset */
  encoderConfig: 'screen-1080p' | 'screen-720p' | 'camera-720p' | 'camera-360p';
}

export interface RoomParticipant {
  /** TRTC userId */
  userId: string;
  /** Role in the DeskPilot session */
  role: 'mobile' | 'pc-agent' | 'ai-bot';
  /** Currently published streams */
  publishedStreams: StreamType[];
  /** When the participant joined */
  joinedAt: number;
}

/** Parameters for creating a Conversational AI bot via REST API */
export interface AIBotConfig {
  /** TRTC room ID for the bot to join */
  roomId: string;
  /** Bot userId (format: bot_{roomId}) */
  botUserId: string;
  /** UserSig for the bot */
  botUserSig: string;
  /** ASR language configuration */
  asrLanguage: string;
  /** TTS voice configuration */
  ttsVoice: string;
}
