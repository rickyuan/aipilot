/**
 * Custom hook for TRTC room connection and stream management.
 *
 * Uses trtc-react-native (NOT the web SDK).
 */

import { useState, useEffect, useCallback } from 'react';
import type { TRTCRoomConfig } from '@deskpilot/shared';
import { initTRTC, joinRoom, leaveRoom, startMicCapture, stopMicCapture } from '../services/trtc';

interface UseTRTCState {
  connected: boolean;
  remoteUsers: string[];
  error: string | null;
}

interface UseTRTCActions {
  connect: (config: TRTCRoomConfig) => void;
  disconnect: () => void;
}

/**
 * Hook for managing TRTC room connection.
 * @returns Connection state and actions
 */
export function useTRTC(): UseTRTCState & UseTRTCActions {
  const [connected, setConnected] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback((config: TRTCRoomConfig) => {
    try {
      initTRTC(config.sdkAppId);
      joinRoom(config);
      startMicCapture();
      setConnected(true);
      setError(null);

      // TODO: Register TRTC event listeners for:
      // - onRemoteUserEnterRoom → update remoteUsers
      // - onRemoteUserLeaveRoom → update remoteUsers
      // - onRecvCustomCmdMsg → handle command results
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
    }
  }, []);

  const disconnect = useCallback(() => {
    stopMicCapture();
    leaveRoom();
    setConnected(false);
    setRemoteUsers([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connected) {
        stopMicCapture();
        leaveRoom();
      }
    };
  }, [connected]);

  return { connected, remoteUsers, error, connect, disconnect };
}
