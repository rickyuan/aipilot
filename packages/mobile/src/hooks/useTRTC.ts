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

/** Bot status: 1=listening, 2=thinking, 3=speaking, 4=interrupted */
export type BotStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted';

/** A single conversation round tracked by roundId */
export interface ConversationMessage {
  roundId: string;
  userText: string;
  aiText: string;
  timestamp: number;
  isCompleted: boolean;
}

interface UseTRTCState {
  connected: boolean;
  remoteUsers: string[];
  error: string | null;
  lastCommandResult: CommandResult | null;
  botStatus: BotStatus;
  botSubtitle: string;
  messages: ConversationMessage[];
}

interface UseTRTCActions {
  connect: (config: TRTCRoomConfig) => void;
  disconnect: () => void;
}

/**
 * Maps numeric bot state to readable status.
 * @param state - Numeric state from TRTC bot
 * @returns Bot status string
 */
function toBotStatus(state: number): BotStatus {
  switch (state) {
    case 1: return 'listening';
    case 2: return 'thinking';
    case 3: return 'speaking';
    case 4: return 'interrupted';
    default: return 'idle';
  }
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
  const [botStatus, setBotStatus] = useState<BotStatus>('idle');
  const [botSubtitle, setBotSubtitle] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const connectedRef = useRef(false);
  const currentRoundRef = useRef<string>('');

  // Listen for TRTC events
  useEffect(() => {
    const handler = (event: TRTCEvent): void => {
      switch (event.type) {
        case 'onEnterRoom':
          if (event.result > 0) {
            console.log(`[useTRTC] Entered room in ${String(event.result)}ms`);
            setConnected(true);
            connectedRef.current = true;
            setError(null);
            // Start mic AFTER successfully entering room
            startMicCapture();
            console.log('[useTRTC] Mic capture started');
          } else {
            console.error(`[useTRTC] Failed to enter room: ${String(event.result)}`);
            setError(`Failed to enter room (code: ${String(event.result)})`);
            setConnected(false);
            connectedRef.current = false;
          }
          break;
        case 'onRemoteUserEnterRoom':
          console.log(`[useTRTC] Remote user entered: ${event.userId}`);
          setRemoteUsers((prev) => [...prev.filter((id) => id !== event.userId), event.userId]);
          break;
        case 'onRemoteUserLeaveRoom':
          setRemoteUsers((prev) => prev.filter((id) => id !== event.userId));
          break;
        case 'onCommandResult':
          setLastCommandResult(event.result);
          break;
        case 'onUserSubtitle':
          // Update user speech text for this round
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.roundId === event.roundId);
            const existing = idx >= 0 ? prev[idx] : undefined;
            if (existing) {
              const updated = [...prev];
              updated[idx] = { ...existing, userText: event.text };
              return updated;
            }
            return [...prev, {
              roundId: event.roundId,
              userText: event.text,
              aiText: '',
              timestamp: Date.now(),
              isCompleted: false,
            }];
          });
          break;
        case 'onBotSubtitle':
          setBotSubtitle(event.text);
          // Update or create message for this roundId with AI text
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.roundId === event.roundId);
            const existing = idx >= 0 ? prev[idx] : undefined;
            if (existing) {
              const updated = [...prev];
              updated[idx] = {
                ...existing,
                aiText: event.text,
                isCompleted: existing.isCompleted || event.end,
              };
              return updated;
            }
            // New round we haven't seen yet
            return [...prev, {
              roundId: event.roundId,
              userText: '',
              aiText: event.text,
              timestamp: Date.now(),
              isCompleted: event.end,
            }];
          });
          break;
        case 'onBotStatus': {
          const newStatus = toBotStatus(event.state);
          setBotStatus(newStatus);
          currentRoundRef.current = event.roundId;
          // When status transitions to "thinking", the user finished speaking
          // The user's speech text comes via onUserSubtitle (type 10002) or
          // we can infer from the subtitle flow. For now, ensure the round exists.
          if (newStatus === 'listening' && event.roundId) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.roundId === event.roundId);
              if (!exists) {
                return [...prev, {
                  roundId: event.roundId,
                  userText: '',
                  aiText: '',
                  timestamp: Date.now(),
                  isCompleted: false,
                }];
              }
              return prev;
            });
          }
          break;
        }
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
      console.log(`[useTRTC] Connecting to room ${config.roomId} as ${config.userId}`);
      initTRTC(config.sdkAppId);
      joinRoom(config);
      // Don't start mic here — wait for onEnterRoom to avoid audio session conflict
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      console.error(`[useTRTC] Connect error: ${message}`);
      setError(message);
    }
  }, []);

  const disconnect = useCallback(() => {
    stopMicCapture();
    leaveRoom();
    setConnected(false);
    connectedRef.current = false;
    setRemoteUsers([]);
    setBotStatus('idle');
    setBotSubtitle('');
    setMessages([]);
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

  return { connected, remoteUsers, error, lastCommandResult, botStatus, botSubtitle, messages, connect, disconnect };
}
