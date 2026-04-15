import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { colors, severityColor, severityLabel } from '../utils/colors';
import { getAllMealsWithSymptoms } from '../db/database';
import { formatDate, formatTime } from '../utils/dateUtils';
import type { MealWithSymptoms } from '../types';

export function FoodHistoryScreen() {
  const navigation = useNavigation<any>();
  const [meals, setMeals] = useState<MealWithSymptoms[]>([]);
  const [query, setQuery] = useState('');

  useFocusEffect(useCallback(() => {
    getAllMealsWithSymptoms().then(setMeals);
  }, []));

  const filtered = query.trim()
    ? meals.filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
    : meals;

  // Group by meal name for the "same food across time" view
  const grouped = filtered.reduce<Record<string, MealWithSymptoms[]>>((acc, m) => {
    const key = m.name.toLowerCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const groups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search foods…"
          placeholderTextColor={colors.textDisabled}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="restaurant-outline" size={48} color={colors.textDisabled} />
          <Text style={styles.emptyText}>No meals found.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={groups}
          keyExtractor={([name]) => name}
          renderItem={({ item: [name, mealList] }) => (
            <Card>
              <View style={styles.groupHeader}>
                <Text style={styles.groupName}>{mealList[0].name}</Text>
                <Text style={styles.groupCount}>{mealList.length}×</Text>
              </View>

              {mealList.map(meal => (
                <TouchableOpacity
                  key={meal.id}
                  style={styles.mealEntry}
                  onPress={() => navigation.navigate('MealDetail', { mealId: meal.id })}
                >
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryDate}>{formatDate(meal.date)}</Text>
                    <Text style={styles.entryTime}>{formatTime(meal.logged_at)}</Text>
                  </View>

                  {meal.symptoms.length === 0 ? (
                    <Text style={styles.noSymptoms}>No symptoms</Text>
                  ) : (
                    meal.symptoms.map(s => (
                      <View key={s.id} style={styles.symptomRow}>
                        <View style={[styles.dot, { backgroundColor: severityColor(s.severity) }]} />
                        <Text style={styles.symptomText} numberOfLines={2}>{s.description}</Text>
                        <Text style={[styles.sevBadge, { color: severityColor(s.severity) }]}>
                          {severityLabel(s.severity)}
                        </Text>
                      </View>
                    ))
                  )}
                </TouchableOpacity>
              ))}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    margin: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: colors.textPrimary },
  content: { paddingHorizontal: 12, paddingBottom: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 16, color: colors.textSecondary },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  groupName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  groupCount: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  mealEntry: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 10, paddingBottom: 6, marginTop: 4,
  },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  entryDate: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  entryTime: { fontSize: 12, color: colors.textDisabled },
  noSymptoms: { fontSize: 12, color: colors.textDisabled, fontStyle: 'italic' },
  symptomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  symptomText: { flex: 1, fontSize: 13, color: colors.textPrimary },
  sevBadge: { fontSize: 11, fontWeight: '600', flexShrink: 0 },
});
