import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, severityColor, severityLabel } from '../utils/colors';
import { SeverityPicker } from '../components/SeverityPicker';
import { getMealsForDate, getRecentMeals, insertSymptom } from '../db/database';
import { nowISO, todayString, sixHoursAgoISO, formatTime } from '../utils/dateUtils';
import type { Meal } from '../types';

export function LogSymptomScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const preselectedMealId: number | undefined = route.params?.preselectedMealId;

  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedMealId, setSelectedMealId] = useState<number | null>(preselectedMealId ?? null);
  const [linkToMeal, setLinkToMeal] = useState<boolean>(preselectedMealId !== undefined);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(3);
  const [gavisconTsp, setGavisconTsp] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMeals();
  }, []);

  const loadMeals = async () => {
    // Show meals from last 6 hours + today's meals
    const recent = await getRecentMeals(sixHoursAgoISO());
    const today = await getMealsForDate(todayString());
    const combined = [...recent];
    for (const m of today) {
      if (!combined.find(x => x.id === m.id)) combined.push(m);
    }
    // Sort by logged_at desc
    combined.sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    setMeals(combined);
    if (preselectedMealId && !combined.find(m => m.id === preselectedMealId)) {
      // preselected meal older than 6 hours — fetch it too
      const { getMealById } = await import('../db/database');
      const m = await getMealById(preselectedMealId);
      if (m) setMeals(prev => [...prev, m]);
    }
  };

  const save = async () => {
    if (linkToMeal && !selectedMealId) {
      Alert.alert('Select a meal', 'Choose which meal this symptom is associated with.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Describe your symptom', 'Please enter what you are experiencing.');
      return;
    }
    setSaving(true);
    try {
      await insertSymptom({
        meal_id: linkToMeal ? selectedMealId : null,
        date: todayString(),
        logged_at: nowISO(),
        description: description.trim(),
        severity,
        gaviscon_tsp: gavisconTsp,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleOption, !linkToMeal && styles.toggleOptionSelected]}
          onPress={() => setLinkToMeal(false)}
        >
          <Ionicons name="time" size={20} color={!linkToMeal ? colors.primary : colors.textSecondary} />
          <Text style={[styles.toggleText, !linkToMeal && styles.toggleTextSelected]}>
            Standalone (no meal)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleOption, linkToMeal && styles.toggleOptionSelected]}
          onPress={() => setLinkToMeal(true)}
        >
          <Ionicons name="restaurant" size={20} color={linkToMeal ? colors.primary : colors.textSecondary} />
          <Text style={[styles.toggleText, linkToMeal && styles.toggleTextSelected]}>
            Linked to meal
          </Text>
        </TouchableOpacity>
      </View>

      {linkToMeal && (
        <>
          <Text style={styles.label}>Which meal caused this?</Text>
            {meals.length === 0 ? (
              <Text style={styles.noMeals}>No recent meals found. Log a meal first.</Text>
            ) : (
              meals.map(meal => {
                const selected = selectedMealId === meal.id;
                return (
                  <TouchableOpacity
                    key={meal.id}
                    style={[styles.mealOption, selected && styles.mealOptionSelected]}
                    onPress={() => setSelectedMealId(meal.id)}
                  >
                    <View style={styles.mealOptionLeft}>
                      <Text style={[styles.mealOptionName, selected && styles.mealOptionNameSelected]}>{meal.name}</Text>
                        <Text style={styles.mealOptionTime}>{formatTime(meal.logged_at)} · {meal.date}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })
            )}
        </>
      )}

      <Text style={styles.label}>What are you experiencing?</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="e.g. Heartburn, acid reflux, bloating, nausea…"
        placeholderTextColor={colors.textDisabled}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        autoFocus
      />

      <Text style={styles.label}>Severity</Text>
      <SeverityPicker value={severity} onChange={setSeverity} />
      <Text style={[styles.severityLabel, { color: severityColor(severity) }]}>
        {severity} — {severityLabel(severity)}
      </Text>

      <Text style={styles.label}>Gaviscon taken (tsp)</Text>
      <View style={styles.gavisconRow}>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => setGavisconTsp(t => Math.max(0, t - 1))}
        >
          <Ionicons name="remove" size={20} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.counterVal}>{gavisconTsp}</Text>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => setGavisconTsp(t => t + 1)}
        >
          <Ionicons name="add" size={20} color={colors.accent} />
        </TouchableOpacity>
        {gavisconTsp > 0 && (
          <Text style={styles.gavisconHint}>{gavisconTsp} tsp to treat this symptom</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, (saving || (linkToMeal && !selectedMealId)) && styles.saveBtnDisabled]}
        onPress={save}
        disabled={saving || (linkToMeal && !selectedMealId)}
      >
        {saving ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="pulse" size={20} color="#fff" />
            <Text style={styles.saveBtnText}> Save symptom</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  toggleOptionSelected: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextSelected: {
    color: colors.primary,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 16 },
  noMeals: { color: colors.textDisabled, fontStyle: 'italic', marginBottom: 8 },
  mealOption: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  mealOptionLeft: { flex: 1 },
  mealOptionName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  mealOptionNameSelected: { color: colors.primary },
  mealOptionTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  multiline: { minHeight: 80 },
  severityLabel: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  gavisconRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.accentLight },
  counterVal: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, minWidth: 28, textAlign: 'center' },
  gavisconHint: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  saveBtn: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
