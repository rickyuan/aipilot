/**
 * Custom hook for voice input UI state.
 *
 * In TRTC Conversational AI mode, the mic is always on after room join.
 * The bot handles ASR/TTS automatically. This hook only tracks UI state.
 */

import { useState, useCallback } from 'react';
import { startMicCapture, stopMicCapture } from '../services/trtc';

interface UseVoiceState {
  isMicActive: boolean;
  isProcessing: boolean;
}

interface UseVoiceActions {
  toggleMic: () => void;
  setProcessing: (processing: boolean) => void;
  setMicActive: (active: boolean) => void;
}

/**
 * Hook for managing voice input UI state.
 * @returns Mic state and control actions
 */
export function useVoice(): UseVoiceState & UseVoiceActions {
  const [isMicActive, setIsMicActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleMic = useCallback(() => {
    setIsMicActive((prev) => {
      const next = !prev;
      if (next) {
        startMicCapture();
      } else {
        stopMicCapture();
      }
      return next;
    });
  }, []);

  const setProcessing = useCallback((processing: boolean) => {
    setIsProcessing(processing);
  }, []);

  const setMicActive = useCallback((active: boolean) => {
    setIsMicActive(active);
  }, []);

  return { isMicActive, isProcessing, toggleMic, setProcessing, setMicActive };
}
