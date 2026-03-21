/**
 * Home screen — device pairing flow.
 *
 * User enters the 6-digit code shown on their PC to pair devices.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { verifyPairingCode } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePair = async (): Promise<void> => {
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code shown on your PC.');
      return;
    }

    setLoading(true);
    try {
      // TODO: Generate a proper device ID
      const mobileUserId = `mobile_${Date.now()}`;
      const result = await verifyPairingCode(code, mobileUserId);

      navigation.navigate('Remote', {
        sessionId: result.roomId,
        roomId: result.roomId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Pairing failed';
      Alert.alert('Pairing Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>DeskPilot</Text>
        <Text style={styles.subtitle}>Control your PC with voice</Text>
      </View>

      <View style={styles.pairingCard}>
        <Text style={styles.label}>Enter Pairing Code</Text>
        <Text style={styles.hint}>
          Open DeskPilot on your PC to see the 6-digit code
        </Text>

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          placeholderTextColor="#555"
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, code.length !== 6 && styles.buttonDisabled]}
          onPress={handlePair}
          disabled={code.length !== 6 || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connect</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  pairingCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  codeInput: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e0e0e0',
    letterSpacing: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#4a6cf7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#333',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
