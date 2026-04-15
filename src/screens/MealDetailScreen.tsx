import React, { useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { colors, severityColor, severityLabel } from '../utils/colors';
import { getMealById, getSymptomsForMeal, deleteMeal, deleteSymptom } from '../db/database';
import { formatTime, formatDate } from '../utils/dateUtils';
import type { Meal, Symptom } from '../types';

export function MealDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mealId: number = route.params?.mealId;

  const [meal, setMeal] = useState<Meal | null>(null);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [mealId]));

  const loadData = async () => {
    const m = await getMealById(mealId);
    if (!m) { navigation.goBack(); return; }
    const s = await getSymptomsForMeal(mealId);
    setMeal(m);
    setSymptoms(s);
  };

  const handleDeleteMeal = () => {
    Alert.alert('Delete meal?', 'This will also delete all associated symptoms.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteMeal(mealId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleDeleteSymptom = (id: number) => {
    Alert.alert('Delete symptom?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteSymptom(id);
          await loadData();
        },
      },
    ]);
  };

  if (!meal) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {meal.photo_uri && (
        <Image source={{ uri: meal.photo_uri }} style={styles.photo} />
      )}

      <Card>
        <Text style={styles.mealName}>{meal.name}</Text>
        <Text style={styles.mealMeta}>{formatDate(meal.date)} · {formatTime(meal.logged_at)}</Text>
        {meal.description ? <Text style={styles.mealDesc}>{meal.description}</Text> : null}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteMeal}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteBtnText}> Delete meal</Text>
        </TouchableOpacity>
      </Card>

      <View style={styles.symptomsHeader}>
        <Text style={styles.sectionTitle}>Symptoms</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('LogSymptom', { preselectedMealId: meal.id })}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Log symptom</Text>
        </TouchableOpacity>
      </View>

      {symptoms.length === 0 ? (
        <Card><Text style={styles.emptyText}>No symptoms logged for this meal.</Text></Card>
      ) : (
        symptoms.map(s => (
          <Card key={s.id} style={styles.symptomCard}>
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <View style={[styles.severityDot, { backgroundColor: severityColor(s.severity) }]} />
                <Text style={[styles.severityText, { color: severityColor(s.severity) }]}>
                  {severityLabel(s.severity)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.symptomTime}>{formatTime(s.logged_at)}</Text>
                <TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteSymptom(s.id)}>
                  <Ionicons name="close" size={16} color={colors.textDisabled} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.symptomDesc}>{s.description}</Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  photo: { width: '100%', height: 220, borderRadius: 12, marginBottom: 12 },
  mealName: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  mealMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  mealDesc: { fontSize: 14, color: colors.textPrimary, marginTop: 8 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  deleteBtnText: { color: colors.danger, fontSize: 13, fontWeight: '500' },
  symptomsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.danger, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  emptyText: { color: colors.textDisabled, textAlign: 'center', fontSize: 14 },
  symptomCard: { paddingVertical: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  severityDot: { width: 10, height: 10, borderRadius: 5 },
  severityText: { fontSize: 13, fontWeight: '600' },
  symptomTime: { fontSize: 12, color: colors.textSecondary },
  delBtn: { marginLeft: 8 },
  symptomDesc: { fontSize: 14, color: colors.textPrimary, marginTop: 6 },
});
