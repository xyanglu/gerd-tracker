import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, Platform, TextInput, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Card } from '../components/Card';
import { colors } from '../utils/colors';
import {
  loadReminderSettings, saveReminderSettings, scheduleAllReminders,
  calcMealTimes, MealReminderSettings,
} from '../utils/notifications';
import { getStoredApiKey, saveApiKey, clearApiKey } from '../services/claudeService';

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmt12(h: number, m: number) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${pad(m)} ${ampm}`;
}

const INTERVAL_OPTIONS: { label: string; value: number }[] = [
  { label: '2 hours', value: 120 },
  { label: '2.5 hours', value: 150 },
  { label: '3 hours', value: 180 },
];

export function SettingsScreen() {
  const [settings, setSettings] = useState<MealReminderSettings | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useFocusEffect(useCallback(() => {
    loadReminderSettings().then(setSettings);
    getStoredApiKey().then(k => { setSavedKey(k); setApiKey(k ?? ''); });
  }, []));

  if (!settings) return null;

  const update = async (patch: Partial<MealReminderSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveReminderSettings(next);
    await scheduleAllReminders(next);
  };

  const handleTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (date) {
      update({ wakeHour: date.getHours(), wakeMinute: date.getMinutes() });
    }
  };

  const mealTimes = calcMealTimes(settings);

  const toggleEnabled = async (val: boolean) => {
    if (val) {
      // check permission eagerly
      const { requestNotificationPermission } = await import('../utils/notifications');
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Notifications blocked',
          'Please enable notifications for GERD Tracker in your device settings.',
        );
        return;
      }
    }
    update({ enabled: val });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Master toggle */}
      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications" size={22} color={colors.primary} />
            <View style={styles.labelBlock}>
              <Text style={styles.cardTitle}>Meal reminders</Text>
              <Text style={styles.cardSub}>Daily notifications to eat</Text>
            </View>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={toggleEnabled}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={settings.enabled ? colors.primaryLight : '#f4f3f4'}
          />
        </View>
      </Card>

      {settings.enabled && (
        <>
          {/* Wake-up time */}
          <Card>
            <Text style={styles.sectionLabel}>Wake-up time</Text>
            <TouchableOpacity style={styles.timeRow} onPress={() => setShowTimePicker(true)}>
              <Ionicons name="alarm-outline" size={20} color={colors.accent} />
              <Text style={styles.timeText}>{fmt12(settings.wakeHour, settings.wakeMinute)}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={(() => {
                  const d = new Date();
                  d.setHours(settings.wakeHour, settings.wakeMinute, 0, 0);
                  return d;
                })()}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
              />
            )}
          </Card>

          {/* Meal count */}
          <Card>
            <Text style={styles.sectionLabel}>Meals per day</Text>
            <View style={styles.optionRow}>
              {[4, 5].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.optionBtn, settings.mealCount === n && styles.optionBtnSelected]}
                  onPress={() => update({ mealCount: n })}
                >
                  <Text style={[styles.optionText, settings.mealCount === n && styles.optionTextSelected]}>
                    {n} meals
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Interval */}
          <Card>
            <Text style={styles.sectionLabel}>Time between meals</Text>
            <View style={styles.optionRow}>
              {INTERVAL_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionBtn, settings.intervalMinutes === opt.value && styles.optionBtnSelected]}
                  onPress={() => update({ intervalMinutes: opt.value })}
                >
                  <Text style={[styles.optionText, settings.intervalMinutes === opt.value && styles.optionTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Preview */}
          <Card style={styles.previewCard}>
            <Text style={styles.sectionLabel}>Reminder schedule</Text>
            {mealTimes.map(([h, m], i) => (
              <View key={i} style={styles.previewRow}>
                <View style={styles.previewDot} />
                <Text style={styles.previewMeal}>Meal {i + 1}</Text>
                <Text style={styles.previewTime}>{fmt12(h, m)}</Text>
              </View>
            ))}
            <Text style={styles.previewNote}>Repeats every day</Text>
          </Card>
        </>
      )}

      {/* Ask AI section */}
      <Text style={[styles.sectionLabel, { marginTop: 24, marginBottom: 8 }]}>Ask AI (optional)</Text>
      <Card>
        <View style={styles.rowLeft}>
          <Ionicons name="sparkles" size={22} color={colors.accent} />
          <View style={styles.labelBlock}>
            <Text style={styles.cardTitle}>Anthropic API key</Text>
            <Text style={styles.cardSub}>Enables conversational AI analysis</Text>
          </View>
        </View>

        <View style={styles.keyRow}>
          <TextInput
            style={styles.keyInput}
            placeholder="sk-ant-..."
            placeholderTextColor={colors.textDisabled}
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowKey(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.keyActions}>
          <TouchableOpacity
            style={styles.saveKeyBtn}
            onPress={async () => {
              if (!apiKey.trim()) return;
              await saveApiKey(apiKey.trim());
              setSavedKey(apiKey.trim());
              Alert.alert('Saved', 'API key saved. The Ask AI tab is now active.');
            }}
          >
            <Text style={styles.saveKeyText}>Save key</Text>
          </TouchableOpacity>

          {savedKey && (
            <TouchableOpacity
              style={styles.clearKeyBtn}
              onPress={() => {
                Alert.alert('Remove API key?', 'This disables AI chat.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove', style: 'destructive', onPress: async () => {
                      await clearApiKey();
                      setSavedKey(null);
                      setApiKey('');
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.clearKeyText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>

        {savedKey && (
          <View style={styles.keyStatus}>
            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
            <Text style={styles.keyStatusText}> Key saved · Ask AI tab is active</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}
          style={styles.getKeyLink}
        >
          <Ionicons name="open-outline" size={13} color={colors.info} />
          <Text style={styles.getKeyLinkText}> Get a free API key →</Text>
        </TouchableOpacity>
        <Text style={styles.costNote}>~$0.30/month at typical use (claude-haiku)</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  labelBlock: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  cardSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeText: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionBtnSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  optionText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  optionTextSelected: { color: colors.primary, fontWeight: '700' },
  previewCard: { backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primary + '44' },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  previewDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  previewMeal: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  previewTime: { fontSize: 14, fontWeight: '700', color: colors.primary },
  previewNote: { fontSize: 12, color: colors.textSecondary, marginTop: 6, fontStyle: 'italic' },
  keyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  keyInput: {
    flex: 1, backgroundColor: colors.background, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textPrimary,
  },
  eyeBtn: { padding: 6 },
  keyActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  saveKeyBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  saveKeyText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  clearKeyBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  clearKeyText: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  keyStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  keyStatusText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  getKeyLink: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  getKeyLinkText: { fontSize: 13, color: colors.info },
  costNote: { fontSize: 11, color: colors.textDisabled, marginTop: 4 },
});
