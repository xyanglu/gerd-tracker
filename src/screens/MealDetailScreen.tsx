import React, { useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { colors, severityColor, severityLabel } from '../utils/colors';
import { getMealById, getSymptomsForMeal, deleteMeal, deleteSymptom, updateMeal, getMealPhotos, deleteMealPhoto } from '../db/database';
import { formatTime, formatDate } from '../utils/dateUtils';
import type { Meal, Symptom } from '../types';

export function MealDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mealId: number = route.params?.mealId;

  const [meal, setMeal] = useState<Meal | null>(null);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useFocusEffect(useCallback(() => {
    loadData();
  }, [mealId]));

  const loadData = async () => {
    const m = await getMealById(mealId);
    if (!m) { navigation.goBack(); return; }
    const [s, p] = await Promise.all([getSymptomsForMeal(mealId), getMealPhotos(mealId)]);
    setMeal(m);
    setSymptoms(s);
    setPhotos(p);
  };

  const handleRenameSave = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || !meal) return;
    await updateMeal(mealId, { name: trimmed });
    setMeal({ ...meal, name: trimmed });
    setEditingName(false);
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

  const handleDeletePhoto = (uri: string) => {
    Alert.alert('Remove photo?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await deleteMealPhoto(mealId, uri);
          setPhotos(prev => prev.filter(p => p !== uri));
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
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll} contentContainerStyle={styles.photosContent}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => handleDeletePhoto(uri)}>
                <Ionicons name="close-circle" size={26} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <Card>
        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRenameSave}
            />
            <TouchableOpacity onPress={handleRenameSave} style={styles.nameEditBtn}>
              <Ionicons name="checkmark" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingName(false)} style={styles.nameEditBtn}>
              <Ionicons name="close" size={20} color={colors.textDisabled} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.nameRow} onPress={() => { setNameInput(meal.name); setEditingName(true); }}>
            <Text style={styles.mealName}>{meal.name}</Text>
            <Ionicons name="pencil-outline" size={16} color={colors.textDisabled} style={styles.pencil} />
          </TouchableOpacity>
        )}
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
            {s.gaviscon_tsp > 0 && (
              <View style={styles.gavisconRow}>
                <Ionicons name="medical" size={12} color={colors.accent} />
                <Text style={styles.gavisconText}> {s.gaviscon_tsp} tsp Gaviscon</Text>
              </View>
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  photosScroll: { marginBottom: 12 },
  photosContent: { gap: 10 },
  photoWrapper: { position: 'relative' },
  photo: { width: 260, height: 200, borderRadius: 12 },
  photoRemoveBtn: { position: 'absolute', top: 6, right: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  mealName: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  pencil: { marginLeft: 6 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameInput: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.textPrimary, borderBottomWidth: 1.5, borderBottomColor: colors.primary, paddingVertical: 2 },
  nameEditBtn: { padding: 4 },
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
  gavisconRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  gavisconText: { fontSize: 12, color: colors.accent, fontWeight: '500' },
});
