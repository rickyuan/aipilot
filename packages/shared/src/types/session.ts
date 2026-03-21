/**
 * Session and device pairing types.
 *
 * Device pairing uses TOTP-based 6-digit codes.
 * PC shows code, user enters on mobile. Pairing expires in 5 minutes.
 */

export interface Session {
  /** Unique session ID */
  sessionId: string;
  /** User ID who owns this session */
  userId: string;
  /** TRTC room ID (format: dp_{userId}_{timestamp}) */
  roomId: string;
  /** Whether the session is currently active */
  active: boolean;
  /** Session creation timestamp */
  createdAt: number;
  /** Last activity timestamp — auto-disconnect after 30 min of no voice input */
  lastActivityAt: number;
  /** Per-session HMAC key for command payload signing */
  hmacKey: string;
}

export interface DevicePairing {
  /** The 6-digit TOTP pairing code */
  pairingCode: string;
  /** User ID of the PC that generated the code */
  pcUserId: string;
  /** When the pairing code was generated */
  createdAt: number;
  /** When the pairing code expires (5 minutes after creation) */
  expiresAt: number;
  /** Whether this code has been consumed */
  consumed: boolean;
}

export interface PairedDevice {
  /** Device ID */
  deviceId: string;
  /** 'mobile' or 'pc' */
  deviceType: 'mobile' | 'pc';
  /** User-friendly device name */
  deviceName: string;
  /** TRTC userId for this device */
  trtcUserId: string;
  /** When the device was paired */
  pairedAt: number;
}
