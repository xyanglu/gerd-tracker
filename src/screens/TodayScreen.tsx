import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { colors } from '../utils/colors';
import {
  getOrCreateDay, updateDay, startToiletSession, endToiletSession,
  getToiletSessions, getMealsForDate, deleteToiletSession, deleteMeal,
} from '../db/database';
import { todayString, nowISO, formatDurationSec, formatTime, secondsBetween } from '../utils/dateUtils';
import type { Day, ToiletSession, Meal } from '../types';

const WATER_GOAL = 1000;
const WATER_STEP = 250;

export function TodayScreen() {
  const navigation = useNavigation<any>();
  const today = todayString();

  const [day, setDay] = useState<Day | null>(null);
  const [sessions, setSessions] = useState<ToiletSession[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [activeSession, setActiveSession] = useState<{ id: number; start: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const d = await getOrCreateDay(today);
    const s = await getToiletSessions(today);
    const m = await getMealsForDate(today);
    setDay(d);
    setSessions(s);
    setMeals(m);
    // resume active session if any (end_time null)
    const open = s.find(x => x.end_time === null);
    if (open && !activeSession) {
      setActiveSession({ id: open.id, start: open.start_time });
    }
  }, [today]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // tick timer
  useEffect(() => {
    if (activeSession) {
      timerRef.current = setInterval(() => {
        setElapsed(secondsBetween(activeSession.start, nowISO()));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSession]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Water
  const addWater = async (ml: number) => {
    if (!day) return;
    const newVal = Math.max(0, Math.min(WATER_GOAL * 2, day.water_ml + ml));
    await updateDay(today, { water_ml: newVal });
    setDay({ ...day, water_ml: newVal });
  };

  // Metamucil
  const toggleMetamucil = async () => {
    if (!day) return;
    const newVal = day.metamucil ? 0 : 1;
    await updateDay(today, { metamucil: newVal });
    setDay({ ...day, metamucil: newVal });
  };

  // Gaviscon
  const changeGaviscon = async (delta: number) => {
    if (!day) return;
    const newVal = Math.max(0, day.gaviscon_doses + delta);
    await updateDay(today, { gaviscon_doses: newVal });
    setDay({ ...day, gaviscon_doses: newVal });
  };

  // Toilet timer
  const startTimer = async () => {
    const now = nowISO();
    const id = await startToiletSession(today, now);
    setActiveSession({ id, start: now });
  };

  const stopTimer = async () => {
    if (!activeSession) return;
    const now = nowISO();
    const dur = secondsBetween(activeSession.start, now);
    await endToiletSession(activeSession.id, now, dur);
    setActiveSession(null);
    await load();
  };

  const deleteMealEntry = (id: number) => {
    Alert.alert('Delete meal?', 'This will also delete all associated symptoms.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteMeal(id);
          await load();
        },
      },
    ]);
  };

  const deleteSession = (id: number) => {
    Alert.alert('Delete session?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteToiletSession(id);
          await load();
        },
      },
    ]);
  };

  const totalToiletTime = sessions
    .filter(s => s.duration_seconds !== null)
    .reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);

  const waterPct = Math.min(1, (day?.water_ml ?? 0) / WATER_GOAL);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.dateHeader}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>

      {/* Water */}
      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.rowCenter}>
            <Ionicons name="water" size={22} color={colors.info} />
            <Text style={styles.cardTitle}> Water</Text>
          </View>
          <Text style={styles.metricValue}>
            {day?.water_ml ?? 0} / {WATER_GOAL} mL
          </Text>
        </View>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${waterPct * 100}%`, backgroundColor: waterPct >= 1 ? colors.primaryLight : colors.info }]} />
        </View>
        {waterPct >= 1 && (
          <Text style={styles.goalMet}>Goal reached!</Text>
        )}
        <View style={styles.rowCenter}>
          <TouchableOpacity style={styles.waterBtn} onPress={() => addWater(-WATER_STEP)}>
            <Ionicons name="remove" size={20} color={colors.info} />
          </TouchableOpacity>
          <Text style={styles.waterStepLabel}>250 mL</Text>
          <TouchableOpacity style={styles.waterBtn} onPress={() => addWater(WATER_STEP)}>
            <Ionicons name="add" size={20} color={colors.info} />
          </TouchableOpacity>
        </View>
      </Card>

      {/* Metamucil */}
      <Card>
        <TouchableOpacity style={styles.rowBetween} onPress={toggleMetamucil}>
          <View style={styles.rowCenter}>
            <Ionicons name="leaf" size={22} color={colors.primary} />
            <Text style={styles.cardTitle}> Metamucil</Text>
          </View>
          <View style={[styles.checkbox, day?.metamucil ? styles.checkboxOn : styles.checkboxOff]}>
            {day?.metamucil ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
          </View>
        </TouchableOpacity>
      </Card>

      {/* Gaviscon */}
      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.rowCenter}>
            <Ionicons name="medical" size={22} color={colors.accent} />
            <Text style={styles.cardTitle}> Gaviscon doses</Text>
          </View>
          <View style={styles.counter}>
            <TouchableOpacity onPress={() => changeGaviscon(-1)} style={styles.counterBtn}>
              <Ionicons name="remove" size={20} color={colors.accent} />
            </TouchableOpacity>
            <Text style={styles.counterVal}>{day?.gaviscon_doses ?? 0}</Text>
            <TouchableOpacity onPress={() => changeGaviscon(1)} style={styles.counterBtn}>
              <Ionicons name="add" size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>
      </Card>

      {/* Toilet Timer */}
      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.rowCenter}>
            <Ionicons name="timer" size={22} color={colors.textSecondary} />
            <Text style={styles.cardTitle}> Toilet time</Text>
          </View>
          <Text style={styles.metricValue}>
            {formatDurationSec(totalToiletTime + (activeSession ? elapsed : 0))} today
          </Text>
        </View>
        {activeSession ? (
          <View style={styles.timerActive}>
            <Text style={styles.timerElapsed}>{formatDurationSec(elapsed)}</Text>
            <TouchableOpacity style={[styles.timerBtn, { backgroundColor: colors.danger }]} onPress={stopTimer}>
              <Ionicons name="stop-circle" size={20} color="#fff" />
              <Text style={styles.timerBtnText}> Stop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.timerBtn, { backgroundColor: colors.primary }]} onPress={startTimer}>
            <Ionicons name="play-circle" size={20} color="#fff" />
            <Text style={styles.timerBtnText}> Start session</Text>
          </TouchableOpacity>
        )}
        {sessions.filter(s => s.duration_seconds !== null).map(s => (
          <View key={s.id} style={styles.sessionRow}>
            <Text style={styles.sessionText}>
              {formatTime(s.start_time)} — {formatDurationSec(s.duration_seconds!)}
            </Text>
            <TouchableOpacity onPress={() => deleteSession(s.id)}>
              <Ionicons name="trash-outline" size={16} color={colors.textDisabled} />
            </TouchableOpacity>
          </View>
        ))}
      </Card>

      {/* Meals */}
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Today's meals</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('LogMeal', { date: today })}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Log meal</Text>
        </TouchableOpacity>
      </View>

      {meals.length === 0 ? (
        <Card><Text style={styles.emptyText}>No meals logged yet.</Text></Card>
      ) : (
        meals.map(meal => (
          <TouchableOpacity
            key={meal.id}
            onPress={() => navigation.navigate('MealDetail', { mealId: meal.id })}
          >
            <Card style={styles.mealCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.mealName}>{meal.name}</Text>
                <View style={styles.rowCenter}>
                  <Text style={styles.mealTime}>{formatTime(meal.logged_at)}</Text>
                  <TouchableOpacity
                    style={styles.mealDeleteBtn}
                    onPress={() => deleteMealEntry(meal.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.textDisabled} />
                  </TouchableOpacity>
                </View>
              </View>
              {meal.description ? <Text style={styles.mealDesc}>{meal.description}</Text> : null}
              {meal.gaviscon_doses > 0 && (
                <View style={styles.gavisconBadge}>
                  <Ionicons name="medical" size={12} color={colors.accent} />
                  <Text style={styles.gavisconBadgeText}> {meal.gaviscon_doses} Gaviscon</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.logSymptomBtn}
                onPress={() => navigation.navigate('LogSymptom', { preselectedMealId: meal.id })}
              >
                <Ionicons name="pulse" size={14} color={colors.danger} />
                <Text style={styles.logSymptomText}> Log symptom</Text>
              </TouchableOpacity>
            </Card>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  dateHeader: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  metricValue: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  progressBg: { height: 10, backgroundColor: colors.border, borderRadius: 5, marginVertical: 10 },
  progressFill: { height: 10, borderRadius: 5 },
  goalMet: { fontSize: 12, color: colors.primary, fontWeight: '600', marginBottom: 4 },
  waterBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.infoLight },
  waterStepLabel: { flex: 1, textAlign: 'center', color: colors.textSecondary, fontSize: 13 },
  checkbox: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.primary },
  checkboxOff: { backgroundColor: colors.border },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: { padding: 6, borderRadius: 8, backgroundColor: colors.accentLight },
  counterVal: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, minWidth: 28, textAlign: 'center' },
  timerActive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  timerElapsed: { fontSize: 28, fontWeight: '700', color: colors.primary },
  timerBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, marginTop: 10, alignSelf: 'flex-start' },
  timerBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border },
  sessionText: { fontSize: 13, color: colors.textSecondary },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  mealCard: { paddingVertical: 12 },
  mealName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  mealTime: { fontSize: 12, color: colors.textSecondary },
  mealDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  logSymptomBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  logSymptomText: { fontSize: 13, color: colors.danger, fontWeight: '500' },
  emptyText: { color: colors.textDisabled, textAlign: 'center', fontSize: 14 },
  mealDeleteBtn: { marginLeft: 8 },
  gavisconBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  gavisconBadgeText: { fontSize: 12, color: colors.accent, fontWeight: '500' },
});
