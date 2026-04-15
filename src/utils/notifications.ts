import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

export interface MealReminderSettings {
  enabled: boolean;
  wakeHour: number;   // 0–23
  wakeMinute: number; // 0–59
  mealCount: number;  // 4 or 5
  intervalMinutes: number; // 120, 150, or 180
}

const SETTINGS_KEY = 'meal_reminder_settings';
const NOTIFICATION_ID_PREFIX = 'meal_reminder_';
const WAKE_UP_KEY = 'wake_up_record';

export const DEFAULT_SETTINGS: MealReminderSettings = {
  enabled: false,
  wakeHour: 8,
  wakeMinute: 0,
  mealCount: 4,
  intervalMinutes: 150, // 2.5 hours default
};

export async function loadReminderSettings(): Promise<MealReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveReminderSettings(settings: MealReminderSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Returns the scheduled meal times as [hour, minute] pairs */
export function calcMealTimes(settings: MealReminderSettings): [number, number][] {
  const times: [number, number][] = [];
  let totalMinutes = settings.wakeHour * 60 + settings.wakeMinute;
  for (let i = 0; i < settings.mealCount; i++) {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    times.push([h, m]);
    totalMinutes += settings.intervalMinutes;
  }
  return times;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

const MEAL_LABELS = ['1st', '2nd', '3rd', '4th', '5th'];

export async function scheduleAllReminders(settings: MealReminderSettings): Promise<void> {
  try {
    await cancelAllReminders();

    if (!settings.enabled) return;

    const granted = await requestNotificationPermission();
    if (!granted) return;

    await Notifications.setNotificationChannelAsync('meal-reminders', {
      name: 'Meal Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });

    const times = calcMealTimes(settings);

    for (let i = 0; i < times.length; i++) {
      const [hour, minute] = times[i];
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_ID_PREFIX}${i}`,
        content: {
          title: `Time to eat! (${MEAL_LABELS[i]} meal)`,
          body: 'Log your meal in GERD Tracker.',
          sound: 'default',
          data: { type: 'meal_reminder', index: i },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
    }
  } catch {
    // Notifications not supported in this environment (e.g. Expo Go)
  }
}

/** Returns 180 (3h) for early risers (before 8 am), 120 (2h) otherwise. */
export function intervalForWakeHour(hour: number): number {
  return hour < 8 ? 180 : 120;
}

/** Persist today's wake-up time. */
export async function saveTodayWakeUp(time: Date): Promise<void> {
  await AsyncStorage.setItem(
    WAKE_UP_KEY,
    JSON.stringify({ date: format(time, 'yyyy-MM-dd'), iso: time.toISOString() }),
  );
}

/** Returns the wake-up Date if one was recorded today, otherwise null. */
export async function getTodayWakeUp(): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(WAKE_UP_KEY);
    if (!raw) return null;
    const { date, iso } = JSON.parse(raw);
    if (date !== format(new Date(), 'yyyy-MM-dd')) return null;
    return new Date(iso);
  } catch {
    return null;
  }
}

export async function cancelAllReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(NOTIFICATION_ID_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}
