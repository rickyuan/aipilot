/**
 * Conversation subtitle view — displays user and AI speech as chat bubbles.
 *
 * Based on TRTC Conversational AI demo pattern:
 * - User speech: right-aligned blue bubbles
 * - AI speech: left-aligned white bubbles
 * - Messages tracked by roundId, accumulate until end flag
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { ConversationMessage } from '../hooks/useTRTC';

interface ConversationViewProps {
  messages: ConversationMessage[];
}

/**
 * Renders the conversation message list.
 * @param props - Component props
 * @returns Conversation view element
 */
export function ConversationView({ messages }: ConversationViewProps): React.JSX.Element {
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  if (messages.length === 0) {
    return <View />;
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {messages.map((msg) => (
        <View key={msg.roundId}>
          {/* User speech bubble */}
          {msg.userText ? (
            <View style={styles.userRow}>
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{msg.userText}</Text>
              </View>
            </View>
          ) : null}

          {/* AI speech bubble */}
          {msg.aiText ? (
            <View style={styles.aiRow}>
              <View style={styles.aiBubble}>
                <Text style={styles.aiText}>{msg.aiText}</Text>
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
    paddingLeft: 80,
  },
  aiRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
    paddingRight: 60,
  },
  userBubble: {
    backgroundColor: 'rgba(64, 134, 255, 0.85)',
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    lineHeight: 22,
  },
  aiText: {
    color: 'rgba(0, 0, 0, 0.72)',
    fontSize: 16,
    lineHeight: 22,
  },
});
