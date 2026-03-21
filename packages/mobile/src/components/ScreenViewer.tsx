/**
 * Screen viewer component — renders the remote PC screen share.
 *
 * Uses TRTCVideoView from trtc-react-native when the native module is linked.
 * Falls back to a placeholder when TRTC is in mock mode.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isNativeModuleAvailable, trtcEvents } from '../services/trtc';
import type { TRTCEvent } from '../services/trtc';

interface ScreenViewerProps {
  /** TRTC userId of the PC Agent publishing the screen */
  pcUserId: string;
  /** Whether the stream is connected and rendering */
  connected: boolean;
}

/**
 * Dynamically loads TRTCVideoView if available.
 */
function getTRTCVideoView(): React.ComponentType<Record<string, unknown>> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('trtc-react-native');
    return mod.TRTCVideoView ?? null;
  } catch {
    return null;
  }
}

export function ScreenViewer({ pcUserId, connected }: ScreenViewerProps): React.JSX.Element {
  const [videoAvailable, setVideoAvailable] = useState(false);
  const TRTCVideoView = isNativeModuleAvailable() ? getTRTCVideoView() : null;

  // Listen for video availability events
  useEffect(() => {
    const handler = (event: TRTCEvent): void => {
      if (event.type === 'onUserVideoAvailable' && event.userId === pcUserId) {
        setVideoAvailable(event.available);
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

  // Real TRTC video view
  if (TRTCVideoView && videoAvailable) {
    return (
      <View style={styles.container}>
        <TRTCVideoView
          userId={pcUserId}
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
          Connected to {pcUserId}
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
