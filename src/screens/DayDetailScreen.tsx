import React, { useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { colors, severityColor, severityLabel } from '../utils/colors';
import { getDayDetail } from '../db/database';
import { formatDate, formatTime, formatDurationSec, totalToiletMinutes } from '../utils/dateUtils';
import type { DayDetail } from '../types';

export function DayDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const date: string = route.params?.date;
  const [detail, setDetail] = useState<DayDetail | null>(null);

  useFocusEffect(useCallback(() => {
    getDayDetail(date).then(setDetail);
  }, [date]));

  if (!detail) return null;

  const toiletTotal = totalToiletMinutes(detail.toilet_sessions);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{formatDate(date)}</Text>

      {/* Metrics */}
      <Card>
        <Text style={styles.sectionTitle}>Daily metrics</Text>
        <MetricRow icon="water" color={colors.info} label="Water" value={`${detail.water_ml} mL`} good={detail.water_ml >= 1000} />
        <MetricRow icon="leaf" color={colors.primary} label="Metamucil" value={detail.metamucil ? 'Taken' : 'Not taken'} good={!!detail.metamucil} />
        <MetricRow icon="medical" color={colors.accent} label="Gaviscon" value={`${detail.gaviscon_doses} dose${detail.gaviscon_doses !== 1 ? 's' : ''}`} />
        <MetricRow icon="timer" color={colors.textSecondary} label="Toilet time" value={`${toiletTotal} min`} />
      </Card>

      {/* Toilet sessions */}
      {detail.toilet_sessions.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>Toilet sessions</Text>
          {detail.toilet_sessions.map(s => (
            <View key={s.id} style={styles.sessionRow}>
              <Text style={styles.sessionTime}>{formatTime(s.start_time)}</Text>
              <Text style={styles.sessionDur}>
                {s.duration_seconds != null ? formatDurationSec(s.duration_seconds) : 'In progress'}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Meals and symptoms */}
      <Text style={styles.sectionTitle2}>Meals & symptoms</Text>
      {detail.meals.length === 0 ? (
        <Card><Text style={styles.empty}>No meals logged.</Text></Card>
      ) : (
        detail.meals.map(meal => (
          <TouchableOpacity key={meal.id} onPress={() => navigation.navigate('MealDetail', { mealId: meal.id })}>
            <Card style={styles.mealCard}>
              {meal.photo_uri && <Image source={{ uri: meal.photo_uri }} style={styles.mealPhoto} />}
              <View style={styles.rowBetween}>
                <Text style={styles.mealName}>{meal.name}</Text>
                <Text style={styles.mealTime}>{formatTime(meal.logged_at)}</Text>
              </View>
              {meal.description ? <Text style={styles.mealDesc}>{meal.description}</Text> : null}
              {meal.symptoms.length > 0 && (
                <View style={styles.symptomsContainer}>
                  {meal.symptoms.map(s => (
                    <View key={s.id} style={[styles.symptomChip, { borderColor: severityColor(s.severity) }]}>
                      <View style={[styles.dot, { backgroundColor: severityColor(s.severity) }]} />
                      <Text style={styles.symptomText} numberOfLines={1}>{s.description}</Text>
                      <Text style={[styles.sevLabel, { color: severityColor(s.severity) }]}>
                        · {severityLabel(s.severity)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {meal.symptoms.length === 0 && (
                <Text style={styles.noSymptoms}>No symptoms</Text>
              )}
            </Card>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function MetricRow({ icon, color, label, value, good }: { icon: string; color: string; label: string; value: string; good?: boolean }) {
  return (
    <View style={styles.metricRow}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, good && { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  sectionTitle2: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  metricRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  metricLabel: { flex: 1, fontSize: 14, color: colors.textSecondary },
  metricValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  sessionTime: { fontSize: 13, color: colors.textSecondary },
  sessionDur: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  mealCard: {},
  mealPhoto: { width: '100%', height: 150, borderRadius: 8, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  mealTime: { fontSize: 12, color: colors.textSecondary },
  mealDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  symptomsContainer: { marginTop: 8, gap: 6 },
  symptomChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 6, gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  symptomText: { flex: 1, fontSize: 13, color: colors.textPrimary },
  sevLabel: { fontSize: 11, fontWeight: '600' },
  noSymptoms: { fontSize: 12, color: colors.textDisabled, marginTop: 6, fontStyle: 'italic' },
  empty: { color: colors.textDisabled, textAlign: 'center', fontSize: 14 },
});
