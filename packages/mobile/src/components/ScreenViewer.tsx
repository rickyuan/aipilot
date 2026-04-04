/**
 * Screen viewer component — renders the remote PC screen share.
 *
 * Subscribes to the sub-stream (screen share) from the PC user.
 * The PC publishes screen via TRTC Web SDK startScreenShare() which
 * uses STREAM_TYPE_SUB. On native SDK, this triggers onUserSubStreamAvailable.
 *
 * Uses TXVideoView.RemoteView from trtc-react-native when available.
 * Falls back to a placeholder when TRTC is in mock mode.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isNativeModuleAvailable, getTXVideoView, trtcEvents } from '../services/trtc';
import type { TRTCEvent } from '../services/trtc';

interface ScreenViewerProps {
  /** TRTC userId of the PC Agent publishing the screen */
  pcUserId: string;
  /** Whether the TRTC room is connected */
  connected: boolean;
}

/**
 * Displays the PC's screen share stream.
 * @param props - Component props
 * @returns Screen viewer element
 */
export function ScreenViewer({ pcUserId, connected }: ScreenViewerProps): React.JSX.Element {
  const [screenAvailable, setScreenAvailable] = useState(false);
  const TXVideoView = isNativeModuleAvailable() ? getTXVideoView() : null;
  const RemoteView = TXVideoView?.RemoteView ?? null;

  // Listen for screen share (sub stream) availability from any user ending with _screen
  useEffect(() => {
    const handler = (event: TRTCEvent): void => {
      // Screen share comes as sub stream from {pcUserId}_screen user
      if (event.type === 'onUserSubStreamAvailable') {
        setScreenAvailable(event.available);
      }
      // Also handle main stream video as fallback
      if (event.type === 'onUserVideoAvailable' && event.userId.endsWith('_screen')) {
        setScreenAvailable(event.available);
      }
    };

    trtcEvents.on('event', handler);
    return () => {
      trtcEvents.off('event', handler);
    };
  }, [pcUserId]);

  if (!connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.waitingText}>Waiting for PC screen...</Text>
        <Text style={styles.hint}>Make sure DeskPilot Agent is running on your PC</Text>
      </View>
    );
  }

  // Real TRTC remote video view — sub stream (screen share)
  if (RemoteView && screenAvailable) {
    return (
      <View style={styles.container}>
        <RemoteView
          userId={`${pcUserId}_screen`}
          streamType={2}
          style={styles.videoView}
          renderMode={1}
        />
      </View>
    );
  }

  // Fallback placeholder
  return (
    <View style={styles.container}>
      <View style={styles.mockScreen}>
        <Text style={styles.connectedText}>
          Connected to room
        </Text>
        <Text style={styles.hint}>
          {isNativeModuleAvailable()
            ? 'Waiting for PC screen share...'
            : 'TRTC native module not linked — screen share will appear when linked'}
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
  videoView: {
    width: '100%',
    height: '100%',
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
