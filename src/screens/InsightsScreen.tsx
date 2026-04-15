import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { colors, severityColor } from '../utils/colors';
import { getAllMealsWithSymptoms } from '../db/database';
import { computeFoodTriggerStats, formatOnset, FoodTriggerStats } from '../utils/analytics';
import type { MealWithSymptoms } from '../types';

type Tab = 'triggers' | 'safe';

export function InsightsScreen() {
  const [meals, setMeals] = useState<MealWithSymptoms[]>([]);
  const [stats, setStats] = useState<FoodTriggerStats[]>([]);
  const [tab, setTab] = useState<Tab>('triggers');

  useFocusEffect(useCallback(() => {
    getAllMealsWithSymptoms().then(m => {
      setMeals(m);
      setStats(computeFoodTriggerStats(m));
    });
  }, []));

  const triggers = stats.filter(s => s.timesWithSymptoms > 0);
  const safeFoods = stats.filter(s => s.safe);
  const shown = tab === 'triggers' ? triggers : safeFoods;

  if (meals.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="bar-chart-outline" size={48} color={colors.textDisabled} />
        <Text style={styles.emptyTitle}>No data yet</Text>
        <Text style={styles.emptySub}>Log meals and symptoms to see patterns.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Summary pills */}
      <View style={styles.summaryRow}>
        <SummaryPill icon="restaurant-outline" color={colors.primary} label={`${meals.length} meals`} />
        <SummaryPill icon="pulse" color={colors.danger} label={`${meals.reduce((n, m) => n + m.symptoms.length, 0)} symptoms`} />
        <SummaryPill icon="warning-outline" color={colors.warning} label={`${triggers.length} triggers`} />
        <SummaryPill icon="checkmark-circle-outline" color={colors.primaryLight} label={`${safeFoods.length} safe`} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'triggers' && styles.tabActive]}
          onPress={() => setTab('triggers')}
        >
          <Text style={[styles.tabText, tab === 'triggers' && styles.tabTextActive]}>
            Triggers ({triggers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'safe' && styles.tabActive]}
          onPress={() => setTab('safe')}
        >
          <Text style={[styles.tabText, tab === 'safe' && styles.tabTextActive]}>
            Safe foods ({safeFoods.length})
          </Text>
        </TouchableOpacity>
      </View>

      {shown.length === 0 ? (
        <Card>
          <Text style={styles.emptyCardText}>
            {tab === 'triggers'
              ? 'No symptom triggers found yet. Keep logging!'
              : 'No confirmed safe foods yet. A food is "safe" when it\'s been eaten 2+ times with no symptoms.'}
          </Text>
        </Card>
      ) : (
        shown.map(s => (
          <TriggerCard key={s.name} stat={s} />
        ))
      )}
    </ScrollView>
  );
}

function TriggerCard({ stat }: { stat: FoodTriggerStats }) {
  const [expanded, setExpanded] = useState(false);
  const rate = Math.round(stat.triggerRate * 100);
  const barColor = stat.safe
    ? colors.primaryLight
    : stat.triggerRate >= 0.8 ? colors.danger
    : stat.triggerRate >= 0.5 ? colors.warning
    : colors.accent;

  return (
    <TouchableOpacity onPress={() => setExpanded(e => !e)}>
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.foodName} numberOfLines={1}>{stat.name}</Text>
          {stat.safe ? (
            <View style={[styles.badge, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.primary }]}> Safe</Text>
            </View>
          ) : (
            <Text style={[styles.rateText, { color: barColor }]}>{rate}%</Text>
          )}
        </View>

        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${rate}%`, backgroundColor: barColor }]} />
        </View>

        <View style={styles.metaRow}>
          <MetaPill icon="restaurant-outline" label={`${stat.timesEaten}×`} color={colors.textSecondary} />
          {!stat.safe && stat.timesWithSymptoms > 0 && (
            <MetaPill icon="pulse" label={`${stat.timesWithSymptoms}× triggered`} color={colors.danger} />
          )}
          {stat.avgOnsetMinutes != null && (
            <MetaPill icon="timer-outline" label={`onset ~${formatOnset(stat.avgOnsetMinutes)}`} color={colors.warning} />
          )}
          {stat.avgSeverity != null && (
            <MetaPill
              icon="alert-circle-outline"
              label={`avg ${stat.avgSeverity}/5`}
              color={severityColor(Math.round(stat.avgSeverity))}
            />
          )}
        </View>

        {expanded && stat.commonSymptoms.length > 0 && (
          <View style={styles.symptoms}>
            <Text style={styles.symptomsLabel}>Common symptoms:</Text>
            {stat.commonSymptoms.map(s => (
              <Text key={s} style={styles.symptomItem}>· {s}</Text>
            ))}
          </View>
        )}

        {stat.commonSymptoms.length > 0 && (
          <Text style={styles.expandHint}>
            {expanded ? 'Hide details ▲' : 'Show symptoms ▼'}
          </Text>
        )}
      </Card>
    </TouchableOpacity>
  );
}

function SummaryPill({ icon, color, label }: { icon: string; color: string; label: string }) {
  return (
    <View style={[styles.summaryPill, { borderColor: color + '44', backgroundColor: color + '11' }]}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={[styles.summaryPillText, { color }]}>{label}</Text>
    </View>
  );
}

function MetaPill({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon as any} size={12} color={color} />
      <Text style={[styles.metaPillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 14, color: colors.textDisabled, textAlign: 'center' },
  emptyCardText: { color: colors.textDisabled, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  summaryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  summaryPillText: { fontSize: 13, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: colors.border + '66', borderRadius: 10, padding: 3, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: colors.textPrimary, fontWeight: '700' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  foodName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 },
  rateText: { fontSize: 15, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  progressBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginBottom: 10 },
  progressFill: { height: 6, borderRadius: 3 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaPillText: { fontSize: 12, fontWeight: '500' },
  symptoms: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  symptomsLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  symptomItem: { fontSize: 13, color: colors.textPrimary, marginBottom: 2 },
  expandHint: { fontSize: 12, color: colors.textDisabled, marginTop: 8, textAlign: 'right' },
});
