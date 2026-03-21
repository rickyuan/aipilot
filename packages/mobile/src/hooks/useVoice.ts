/**
 * Custom hook for voice input management.
 *
 * Handles mic activation state and voice activity detection.
 * Integrates with the TRTC service for actual mic control.
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
}

/**
 * Hook for managing voice input UI state with real TRTC mic control.
 * @returns Mic state and control actions
 */
export function useVoice(): UseVoiceState & UseVoiceActions {
  const [isMicActive, setMicActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleMic = useCallback(() => {
    setMicActive((prev) => {
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

  return { isMicActive, isProcessing, toggleMic, setProcessing };
}
