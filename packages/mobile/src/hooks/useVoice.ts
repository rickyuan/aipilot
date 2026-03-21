/**
 * Custom hook for voice input management.
 *
 * Handles mic activation state and voice activity detection.
 * Actual audio is published via TRTC — this hook manages the UI state.
 */

import { useState, useCallback } from 'react';

interface UseVoiceState {
  isMicActive: boolean;
  isProcessing: boolean;
}

interface UseVoiceActions {
  toggleMic: () => void;
  setProcessing: (processing: boolean) => void;
}

/**
 * Hook for managing voice input UI state.
 * @returns Mic state and control actions
 */
export function useVoice(): UseVoiceState & UseVoiceActions {
  const [isMicActive, setMicActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleMic = useCallback(() => {
    setMicActive((prev) => !prev);
    // TODO: Call startMicCapture / stopMicCapture from TRTC service
  }, []);

  const setProcessing = useCallback((processing: boolean) => {
    setIsProcessing(processing);
  }, []);

  return { isMicActive, isProcessing, toggleMic, setProcessing };
}
