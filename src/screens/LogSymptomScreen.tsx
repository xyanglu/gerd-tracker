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
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(3);
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
    if (!selectedMealId) {
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
        meal_id: selectedMealId,
        logged_at: nowISO(),
        description: description.trim(),
        severity,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

      <TouchableOpacity
        style={[styles.saveBtn, (saving || !selectedMealId) && styles.saveBtnDisabled]}
        onPress={save}
        disabled={saving || !selectedMealId}
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
