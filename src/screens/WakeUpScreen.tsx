import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../utils/colors';

interface Props {
  onWakeUp: (wakeTime: Date) => void;
}

export function WakeUpScreen({ onWakeUp }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const intervalHours = hour < 8 ? 3 : 2;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Ionicons name="sunny-outline" size={72} color={colors.primary} style={styles.icon} />
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.time}>{timeStr}</Text>
        <Text style={styles.hint}>
          Tap to start your day — meals will be spaced{' '}
          <Text style={styles.hintBold}>{intervalHours} hours</Text> apart
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => onWakeUp(new Date())}>
          <Text style={styles.btnText}>I'm awake</Text>
          <Ionicons name="arrow-forward-circle" size={26} color="#fff" style={styles.btnIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  time: {
    fontSize: 56,
    fontWeight: '300',
    color: colors.primary,
    marginBottom: 32,
    letterSpacing: -1,
  },
  hint: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 22,
  },
  hintBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 50,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  btnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  btnIcon: {
    marginLeft: 10,
  },
});
