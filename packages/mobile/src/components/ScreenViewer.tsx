/**
 * Screen viewer component — renders the remote PC screen share.
 *
 * In production, this renders the TRTC remote video stream.
 * For now, shows a placeholder until trtc-react-native is linked.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ScreenViewerProps {
  /** TRTC userId of the PC Agent publishing the screen */
  pcUserId: string;
  /** Whether the stream is connected and rendering */
  connected: boolean;
}

export function ScreenViewer({ pcUserId, connected }: ScreenViewerProps): React.JSX.Element {
  if (!connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.waitingText}>Waiting for PC screen...</Text>
        <Text style={styles.hint}>Make sure DeskPilot Agent is running on your PC</Text>
      </View>
    );
  }

  // TODO: Replace with actual TRTCVideoView when native module is linked
  // import { TRTCVideoView } from 'trtc-react-native';
  // return (
  //   <TRTCVideoView
  //     userId={pcUserId}
  //     streamType={TRTCVideoStreamType.Sub} // screen share stream
  //     style={styles.container}
  //   />
  // );

  return (
    <View style={styles.container}>
      <View style={styles.mockScreen}>
        <Text style={styles.connectedText}>
          Connected to {pcUserId}
        </Text>
        <Text style={styles.hint}>
          Screen share will render here when TRTC native module is linked
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockScreen: {
    width: '90%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    fontSize: 18,
    color: '#888',
    marginBottom: 8,
  },
  connectedText: {
    fontSize: 16,
    color: '#4a6cf7',
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
