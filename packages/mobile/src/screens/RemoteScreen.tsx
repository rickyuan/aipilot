/**
 * Remote screen — displays PC screen share with voice control overlay.
 *
 * After pairing, joins the TRTC room, subscribes to PC screen share,
 * and publishes mic audio for AI bot voice conversation.
 * The AI bot handles ASR → LLM → TTS automatically in the TRTC room.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { ScreenViewer } from '../components/ScreenViewer';
import { VoiceIndicator } from '../components/VoiceIndicator';
import { ConversationView } from '../components/ConversationView';
import { useTRTC } from '../hooks/useTRTC';
import { useVoice } from '../hooks/useVoice';
import { isNativeModuleAvailable } from '../services/trtc';

type Props = NativeStackScreenProps<RootStackParamList, 'Remote'>;

export function RemoteScreen({ route }: Props): React.JSX.Element {
  const { roomId, pcUserId, mobileRoomConfig } = route.params;
  const { connected, error, botStatus, botSubtitle, messages, connect, lastCommandResult } = useTRTC();
  const { isMicActive, isProcessing, toggleMic, setMicActive } = useVoice();

  // Join TRTC room on mount with the config from pairing
  useEffect(() => {
    connect(mobileRoomConfig);
  }, [mobileRoomConfig, connect]);

  // Sync mic state with connection — mic auto-starts on successful room join
  useEffect(() => {
    if (connected) {
      setMicActive(true);
    }
  }, [connected, setMicActive]);

  // Bot subtitle or last command result as feedback
  const lastFeedback = botSubtitle
    || (lastCommandResult
      ? (lastCommandResult.success
          ? lastCommandResult.output.slice(0, 200)
          : `Error: ${lastCommandResult.error ?? 'unknown'}`)
      : null);

  // Debug: log connection state
  useEffect(() => {
    console.log(`[RemoteScreen] connected=${String(connected)} botStatus=${botStatus} messages=${String(messages.length)} error=${error ?? 'none'}`);
  }, [connected, botStatus, messages.length, error]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <ScreenViewer pcUserId={pcUserId} connected={connected} />

      {/* Debug banner — remove after testing */}
      <View style={styles.debugBanner}>
        <Text style={styles.debugText}>
          native:{isNativeModuleAvailable() ? 'YES' : 'NO'} | {connected ? '✓room' : '✗room'} | mic:{isMicActive ? 'ON' : 'OFF'} | {botStatus}
        </Text>
        {error ? <Text style={[styles.debugText, {color:'#f87171',marginTop:2}]}>{error}</Text> : null}
      </View>

      {/* Conversation subtitles overlay — bottom half */}
      <View style={styles.conversationOverlay}>
        <ConversationView messages={messages} />
      </View>

      {/* Bot status indicator pill */}
      {botStatus !== 'idle' && (
        <View style={styles.botStatusBar}>
          <View style={[
            styles.botStatusPill,
            botStatus === 'listening' ? styles.statusListening
              : botStatus === 'thinking' ? styles.statusThinking
              : botStatus === 'speaking' ? styles.statusSpeaking
              : styles.statusInterrupted,
          ]}>
            <View style={[
              styles.statusDot,
              botStatus === 'listening' ? styles.dotListening
                : botStatus === 'thinking' ? styles.dotThinking
                : botStatus === 'speaking' ? styles.dotSpeaking
                : styles.dotInterrupted,
            ]} />
            <Text style={styles.botStatusText}>
              {botStatus === 'listening' ? 'Listening...'
                : botStatus === 'thinking' ? 'Thinking...'
                : botStatus === 'speaking' ? 'Speaking...'
                : 'Interrupted'}
            </Text>
          </View>
        </View>
      )}

      {/* Error display */}
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <VoiceIndicator
        isMicActive={isMicActive}
        isProcessing={isProcessing || botStatus === 'thinking'}
        lastFeedback={lastFeedback}
        onToggleMic={toggleMic}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  conversationOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    maxHeight: '40%',
  },
  botStatusBar: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  botStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  statusListening: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  statusThinking: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
  },
  statusSpeaking: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
  },
  statusInterrupted: {
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotListening: {
    backgroundColor: '#4ade80',
  },
  dotThinking: {
    backgroundColor: '#fbbf24',
  },
  dotSpeaking: {
    backgroundColor: '#60a5fa',
  },
  dotInterrupted: {
    backgroundColor: '#f87171',
  },
  botStatusText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  errorBar: {
    position: 'absolute',
    top: 90,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    textAlign: 'center',
  },
  debugBanner: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  debugText: {
    color: '#fbbf24',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
});
