export interface Day {
  id: number;
  date: string; // YYYY-MM-DD
  water_ml: number;
  metamucil: number; // 0 or 1
  gaviscon_doses: number;
}

export interface ToiletSession {
  id: number;
  date: string;
  start_time: string; // ISO datetime
  end_time: string | null;
  duration_seconds: number | null;
}

export interface Meal {
  id: number;
  date: string;
  logged_at: string; // ISO datetime
  name: string;
  description: string | null;
  photo_uri: string | null;
  gaviscon_doses: number;
}

export interface Symptom {
  id: number;
  meal_id: number;
  logged_at: string; // ISO datetime
  description: string;
  severity: number; // 1–5
}

export interface MealWithSymptoms extends Meal {
  symptoms: Symptom[];
}

export interface DayDetail extends Day {
  toilet_sessions: ToiletSession[];
  meals: MealWithSymptoms[];
}
