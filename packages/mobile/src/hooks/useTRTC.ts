/**
 * Custom hook for TRTC room connection and stream management.
 *
 * Manages TRTC connection lifecycle with real event listeners.
 * Uses trtc-react-native (NOT the web SDK).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TRTCRoomConfig, CommandResult } from '@deskpilot/shared';
import { initTRTC, joinRoom, leaveRoom, startMicCapture, stopMicCapture, trtcEvents } from '../services/trtc';
import type { TRTCEvent } from '../services/trtc';

interface UseTRTCState {
  connected: boolean;
  remoteUsers: string[];
  error: string | null;
  lastCommandResult: CommandResult | null;
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
  const [lastCommandResult, setLastCommandResult] = useState<CommandResult | null>(null);
  const connectedRef = useRef(false);

  // Listen for TRTC events
  useEffect(() => {
    const handler = (event: TRTCEvent): void => {
      switch (event.type) {
        case 'onRemoteUserEnterRoom':
          setRemoteUsers((prev) => [...prev.filter((id) => id !== event.userId), event.userId]);
          break;
        case 'onRemoteUserLeaveRoom':
          setRemoteUsers((prev) => prev.filter((id) => id !== event.userId));
          break;
        case 'onCommandResult':
          setLastCommandResult(event.result);
          break;
        case 'onError':
          setError(`TRTC Error ${String(event.code)}: ${event.message}`);
          break;
      }
    };

    trtcEvents.on('event', handler);
    return () => {
      trtcEvents.off('event', handler);
    };
  }, []);

  const connect = useCallback((config: TRTCRoomConfig) => {
    try {
      initTRTC(config.sdkAppId);
      joinRoom(config);
      startMicCapture();
      setConnected(true);
      connectedRef.current = true;
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
    }
  }, []);

  const disconnect = useCallback(() => {
    stopMicCapture();
    leaveRoom();
    setConnected(false);
    connectedRef.current = false;
    setRemoteUsers([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectedRef.current) {
        stopMicCapture();
        leaveRoom();
      }
    };
  }, []);

  return { connected, remoteUsers, error, lastCommandResult, connect, disconnect };
}
