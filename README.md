# GERD Tracker

A personal React Native / Expo app for managing GERD (acid reflux) through daily habit and symptom tracking.

## Features

- **Wake-up gate** — tap when you wake up; meal reminders auto-schedule 2–3 hours apart based on your actual wake time
- **Daily tracking** — water intake, Metamucil, Gaviscon doses, toilet sessions with timer
- **Meal logging** — log meals with description and severity, link symptoms directly to meals
- **Symptom logging** — track reflux events with severity (1–5 scale) and notes
- **Food history** — see which foods have been associated with symptoms over time
- **Insights** — visualize patterns across days and meals
- **Ask AI** — Claude-powered analysis of your GERD data
- **Push notifications** — daily meal reminders scheduled from your real wake-up time

## Tech Stack

- React Native + Expo (managed workflow)
- TypeScript
- SQLite (via `expo-sqlite`) for local persistence
- AsyncStorage for settings/state
- `expo-notifications` for scheduled reminders
- Claude API (Anthropic) for AI insights
- EAS Build for cloud builds

## Getting Started

```bash
npm install
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) to run on your device.

### Build

```bash
# Cloud build via EAS
eas build --platform android
eas build --platform ios
```

## Project Structure

```
src/
  screens/       # All app screens
  components/    # Reusable UI components
  db/            # SQLite database layer
  utils/         # Notifications, colors, date helpers
  services/      # Claude API integration
  types/         # TypeScript types
```
