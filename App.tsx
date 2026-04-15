import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import { TodayScreen } from './src/screens/TodayScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { FoodHistoryScreen } from './src/screens/FoodHistoryScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { AskAIScreen } from './src/screens/AskAIScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LogMealScreen } from './src/screens/LogMealScreen';
import { LogSymptomScreen } from './src/screens/LogSymptomScreen';
import { MealDetailScreen } from './src/screens/MealDetailScreen';
import { DayDetailScreen } from './src/screens/DayDetailScreen';
import { WakeUpScreen } from './src/screens/WakeUpScreen';
import { colors } from './src/utils/colors';
import {
  loadReminderSettings, saveReminderSettings, scheduleAllReminders,
  intervalForWakeHour, getTodayWakeUp, saveTodayWakeUp,
} from './src/utils/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const stackOpts = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.primary,
};

function TodayStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="Today" component={TodayScreen} options={{ title: 'Today' }} />
      <Stack.Screen name="LogMeal" component={LogMealScreen} options={{ title: 'Log Meal' }} />
      <Stack.Screen name="LogSymptom" component={LogSymptomScreen} options={{ title: 'Log Symptom' }} />
      <Stack.Screen name="MealDetail" component={MealDetailScreen} options={{ title: 'Meal Details' }} />
    </Stack.Navigator>
  );
}

function HistoryStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Stack.Screen name="DayDetail" component={DayDetailScreen} options={{ title: 'Day Details' }} />
      <Stack.Screen name="MealDetail" component={MealDetailScreen} options={{ title: 'Meal Details' }} />
      <Stack.Screen name="LogSymptom" component={LogSymptomScreen} options={{ title: 'Log Symptom' }} />
    </Stack.Navigator>
  );
}

function FoodStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="FoodHistory" component={FoodHistoryScreen} options={{ title: 'Food History' }} />
      <Stack.Screen name="MealDetail" component={MealDetailScreen} options={{ title: 'Meal Details' }} />
      <Stack.Screen name="LogSymptom" component={LogSymptomScreen} options={{ title: 'Log Symptom' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  // null = still checking, false = need wake-up, true = done
  const [wakeUpDone, setWakeUpDone] = useState<boolean | null>(null);

  useEffect(() => {
    getTodayWakeUp().then(wakeUp => {
      if (wakeUp) {
        setWakeUpDone(true);
        loadReminderSettings().then(scheduleAllReminders);
      } else {
        setWakeUpDone(false);
      }
    });
  }, []);

  const handleWakeUp = async (time: Date) => {
    await saveTodayWakeUp(time);
    const settings = await loadReminderSettings();
    const updated = {
      ...settings,
      wakeHour: time.getHours(),
      wakeMinute: time.getMinutes(),
      intervalMinutes: intervalForWakeHour(time.getHours()),
      enabled: true,
    };
    await saveReminderSettings(updated);
    await scheduleAllReminders(updated);
    setWakeUpDone(true);
  };

  if (wakeUpDone === null) return null;

  if (!wakeUpDone) {
    return (
      <SafeAreaProvider>
        <WakeUpScreen onWakeUp={handleWakeUp} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              const icons: Record<string, [string, string]> = {
                TodayTab:    ['today',              'today-outline'],
                HistoryTab:  ['calendar',           'calendar-outline'],
                FoodTab:     ['restaurant',         'restaurant-outline'],
                InsightsTab: ['bar-chart',          'bar-chart-outline'],
                AskAITab:    ['sparkles',           'sparkles-outline'],
                SettingsTab: ['settings',           'settings-outline'],
              };
              const [on, off] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
              return <Ionicons name={(focused ? on : off) as any} size={size} color={color} />;
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textDisabled,
            tabBarStyle: { borderTopColor: colors.border },
            headerShown: false,
          })}
        >
          <Tab.Screen name="TodayTab"    component={TodayStack}    options={{ title: 'Today' }} />
          <Tab.Screen name="HistoryTab"  component={HistoryStack}  options={{ title: 'History' }} />
          <Tab.Screen name="FoodTab"     component={FoodStack}     options={{ title: 'Foods' }} />
          <Tab.Screen name="InsightsTab" component={InsightsScreen} options={{ title: 'Insights', headerShown: true, ...stackOpts }} />
          <Tab.Screen name="AskAITab"    component={AskAIScreen}   options={{ title: 'Ask AI',  headerShown: true, ...stackOpts }} />
          <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: 'Settings', headerShown: true, ...stackOpts }} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
