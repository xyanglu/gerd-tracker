import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { colors } from '../utils/colors';
import { getAllDays, getMealsForDate, getToiletSessions } from '../db/database';
import { formatDate, totalToiletMinutes, formatDurationSec } from '../utils/dateUtils';
import type { Day } from '../types';

interface DayRow extends Day {
  mealCount: number;
  toiletMinutes: number;
}

export function HistoryScreen() {
  const navigation = useNavigation<any>();
  const [rows, setRows] = useState<DayRow[]>([]);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  const load = async () => {
    const days = await getAllDays();
    const enriched = await Promise.all(days.map(async d => {
      const meals = await getMealsForDate(d.date);
      const sessions = await getToiletSessions(d.date);
      return {
        ...d,
        mealCount: meals.length,
        toiletMinutes: totalToiletMinutes(sessions),
      };
    }));
    setRows(enriched);
  };

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="calendar-outline" size={48} color={colors.textDisabled} />
        <Text style={styles.emptyText}>No history yet.</Text>
        <Text style={styles.emptySubtext}>Start tracking on the Today tab.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={item => item.date}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => navigation.navigate('DayDetail', { date: item.date })}>
          <Card>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            <View style={styles.pills}>
              <Pill icon="water" color={colors.info} label={`${item.water_ml} mL`} achieved={item.water_ml >= 1000} />
              <Pill icon="leaf" color={colors.primary} label="Metamucil" achieved={item.metamucil === 1} />
              <Pill icon="medical" color={colors.accent} label={`${item.gaviscon_doses}x Gav`} />
              <Pill icon="timer-outline" color={colors.textSecondary} label={`${item.toiletMinutes}m toilet`} />
              <Pill icon="restaurant-outline" color={colors.primaryLight} label={`${item.mealCount} meals`} />
            </View>
          </Card>
        </TouchableOpacity>
      )}
    />
  );
}

function Pill({ icon, color, label, achieved }: { icon: string; color: string; label: string; achieved?: boolean }) {
  return (
    <View style={[styles.pill, achieved && { backgroundColor: color + '22' }]}>
      <Ionicons name={icon as any} size={12} color={color} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.textSecondary },
  emptySubtext: { fontSize: 14, color: colors.textDisabled },
  dateText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.border + '66',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20,
  },
  pillText: { fontSize: 12, fontWeight: '500' },
});
