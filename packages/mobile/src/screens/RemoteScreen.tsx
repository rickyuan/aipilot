/**
 * Remote screen — displays PC screen share with voice control overlay.
 *
 * This is the main screen after pairing. Shows the PC's screen
 * and provides voice input controls.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { ScreenViewer } from '../components/ScreenViewer';
import { VoiceIndicator } from '../components/VoiceIndicator';
import { useTRTC } from '../hooks/useTRTC';
import { useVoice } from '../hooks/useVoice';
import { getRoomConfig } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Remote'>;

export function RemoteScreen({ route }: Props): React.JSX.Element {
  const { roomId } = route.params;
  const { connected, remoteUsers, connect } = useTRTC();
  const { isMicActive, isProcessing, toggleMic, setProcessing } = useVoice();
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);

  // Connect to TRTC room on mount
  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const mobileUserId = `mobile_${Date.now()}`;
        const roomConfig = await getRoomConfig(roomId, mobileUserId);
        connect(roomConfig);
      } catch (err: unknown) {
        console.error('[Remote] Failed to connect:', err);
      }
    };

    init().catch(console.error);
  }, [roomId, connect]);

  // TODO: Listen for command result custom messages from TRTC
  // and update lastFeedback + setProcessing accordingly

  // Find the PC Agent in remote users
  const pcUserId = remoteUsers.find((id) => !id.startsWith('bot_')) ?? 'pc-agent';

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <ScreenViewer pcUserId={pcUserId} connected={connected} />

      <VoiceIndicator
        isMicActive={isMicActive}
        isProcessing={isProcessing}
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
});
