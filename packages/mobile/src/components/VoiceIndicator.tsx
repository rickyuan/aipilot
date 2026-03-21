/**
 * Voice input status indicator — shows mic state and AI processing status.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface VoiceIndicatorProps {
  /** Whether the microphone is active */
  isMicActive: boolean;
  /** Whether the AI bot is processing the voice input */
  isProcessing: boolean;
  /** Last feedback message from the AI bot */
  lastFeedback: string | null;
  /** Toggle mic on/off */
  onToggleMic: () => void;
}

export function VoiceIndicator({
  isMicActive,
  isProcessing,
  lastFeedback,
  onToggleMic,
}: VoiceIndicatorProps): React.JSX.Element {
  const getStatusText = (): string => {
    if (isProcessing) return 'AI is thinking...';
    if (isMicActive) return 'Listening...';
    return 'Tap to speak';
  };

  const getStatusColor = (): string => {
    if (isProcessing) return '#f7c948';
    if (isMicActive) return '#4ade80';
    return '#888';
  };

  return (
    <View style={styles.container}>
      {lastFeedback ? (
        <View style={styles.feedbackBubble}>
          <Text style={styles.feedbackText}>{lastFeedback}</Text>
        </View>
      ) : null}

      <View style={styles.controlRow}>
        <TouchableOpacity
          style={[
            styles.micButton,
            isMicActive && styles.micButtonActive,
            isProcessing && styles.micButtonProcessing,
          ]}
          onPress={onToggleMic}
          disabled={isProcessing}
        >
          <Text style={styles.micIcon}>{isMicActive ? '🎤' : '🔇'}</Text>
        </TouchableOpacity>

        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  feedbackBubble: {
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
    maxWidth: '90%',
  },
  feedbackText: {
    color: '#e0e0e0',
    fontSize: 14,
    textAlign: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonActive: {
    borderColor: '#4ade80',
    backgroundColor: '#0a2a0a',
  },
  micButtonProcessing: {
    borderColor: '#f7c948',
    backgroundColor: '#2a2500',
  },
  micIcon: {
    fontSize: 24,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
