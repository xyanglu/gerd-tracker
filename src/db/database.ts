import * as SQLite from 'expo-sqlite';
import { Day, ToiletSession, Meal, Symptom, MealWithSymptoms, DayDetail } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('gerd_tracker.db');
    await initDb(db);
  }
  return db;
}

async function initDb(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`PRAGMA journal_mode = WAL`);
  await db.execAsync(`PRAGMA foreign_keys = ON`);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      water_ml INTEGER DEFAULT 0,
      metamucil INTEGER DEFAULT 0,
      gaviscon_doses INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS toilet_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      photo_uri TEXT,
      gaviscon_doses INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS symptoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      description TEXT NOT NULL,
      severity INTEGER NOT NULL DEFAULT 3,
      gaviscon_tsp INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS meal_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
      photo_uri TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
  `);
  // Migration: add gaviscon_doses to meals if it doesn't exist yet
  try {
    await db.execAsync(`ALTER TABLE meals ADD COLUMN gaviscon_doses INTEGER DEFAULT 0`);
  } catch (_) {
    // column already exists
  }
  // Migration: add gaviscon_tsp to symptoms
  try {
    await db.execAsync(`ALTER TABLE symptoms ADD COLUMN gaviscon_tsp INTEGER DEFAULT 0`);
  } catch (_) {
    // column already exists
  }
  // Migration: populate meal_photos from existing single photo_uri values
  try {
    await db.execAsync(`ALTER TABLE meal_photos ADD COLUMN _v1 INTEGER DEFAULT 1`);
    await db.runAsync(
      `INSERT INTO meal_photos (meal_id, photo_uri, sort_order)
       SELECT id, photo_uri, 0 FROM meals WHERE photo_uri IS NOT NULL`
    );
  } catch (_) {
    // already migrated
  }
  // Migration: decouple symptoms from meals
  try {
    await db.execAsync(`ALTER TABLE symptoms ADD COLUMN date TEXT`);
    // Backfill date for existing symptoms from their meal's date
    await db.execAsync(`
      UPDATE symptoms
      SET date = (SELECT date FROM meals WHERE meals.id = symptoms.meal_id)
      WHERE date IS NULL
    `);
    // Make meal_id optional by recreating the table (SQLite limitation)
    await db.execAsync(`
      CREATE TABLE symptoms_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        logged_at TEXT NOT NULL,
        description TEXT NOT NULL,
        severity INTEGER NOT NULL DEFAULT 3,
        gaviscon_tsp INTEGER DEFAULT 0
      );
      INSERT INTO symptoms_new (id, meal_id, date, logged_at, description, severity, gaviscon_tsp)
        SELECT id, meal_id, date, logged_at, description, severity, gaviscon_tsp FROM symptoms;
      DROP TABLE symptoms;
      ALTER TABLE symptoms_new RENAME TO symptoms;
    `);
  } catch (_) {
    // already migrated
  }
}

// ── Day helpers ──────────────────────────────────────────────────────────────

export async function getOrCreateDay(date: string): Promise<Day> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO days (date) VALUES (?)`,
    date
  );
  return db.getFirstAsync<Day>(`SELECT * FROM days WHERE date = ?`, date) as Promise<Day>;
}

export async function updateDay(date: string, fields: Partial<Omit<Day, 'id' | 'date'>>): Promise<void> {
  const db = await getDb();
  await getOrCreateDay(date);
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(fields), date];
  await db.runAsync(`UPDATE days SET ${sets} WHERE date = ?`, vals);
}

export async function getDay(date: string): Promise<Day | null> {
  const db = await getDb();
  return db.getFirstAsync<Day>(`SELECT * FROM days WHERE date = ?`, date);
}

export async function getAllDays(): Promise<Day[]> {
  const db = await getDb();
  return db.getAllAsync<Day>(`SELECT * FROM days ORDER BY date DESC`);
}

// ── Toilet session helpers ───────────────────────────────────────────────────

export async function startToiletSession(date: string, startTime: string): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO toilet_sessions (date, start_time) VALUES (?, ?)`,
    date, startTime
  );
  return result.lastInsertRowId;
}

export async function endToiletSession(id: number, endTime: string, durationSeconds: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE toilet_sessions SET end_time = ?, duration_seconds = ? WHERE id = ?`,
    endTime, durationSeconds, id
  );
}

export async function getToiletSessions(date: string): Promise<ToiletSession[]> {
  const db = await getDb();
  return db.getAllAsync<ToiletSession>(
    `SELECT * FROM toilet_sessions WHERE date = ? ORDER BY start_time ASC`,
    date
  );
}

export async function deleteToiletSession(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM toilet_sessions WHERE id = ?`, id);
}

// ── Meal helpers ─────────────────────────────────────────────────────────────

export async function insertMeal(meal: Omit<Meal, 'id'>): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO meals (date, logged_at, name, description, photo_uri, gaviscon_doses) VALUES (?, ?, ?, ?, ?, ?)`,
    meal.date, meal.logged_at, meal.name, meal.description ?? null, meal.photo_uri ?? null, meal.gaviscon_doses ?? 0
  );
  return result.lastInsertRowId;
}

export async function getMealsForDate(date: string): Promise<Meal[]> {
  const db = await getDb();
  return db.getAllAsync<Meal>(
    `SELECT * FROM meals WHERE date = ? ORDER BY logged_at ASC`,
    date
  );
}

export async function getRecentMeals(since: string): Promise<Meal[]> {
  const db = await getDb();
  return db.getAllAsync<Meal>(
    `SELECT * FROM meals WHERE logged_at >= ? ORDER BY logged_at DESC`,
    since
  );
}

export async function getMealById(id: number): Promise<Meal | null> {
  const db = await getDb();
  return db.getFirstAsync<Meal>(`SELECT * FROM meals WHERE id = ?`, id);
}

export async function updateMeal(id: number, fields: Partial<Pick<Meal, 'name' | 'description'>>): Promise<void> {
  const db = await getDb();
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(fields), id];
  await db.runAsync(`UPDATE meals SET ${sets} WHERE id = ?`, vals);
}

export async function deleteMeal(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM meals WHERE id = ?`, id);
}

export async function getAllMealsWithSymptoms(): Promise<MealWithSymptoms[]> {
  const db = await getDb();
  const meals = await db.getAllAsync<Meal>(`SELECT * FROM meals ORDER BY logged_at DESC`);
  const result: MealWithSymptoms[] = [];
  for (const meal of meals) {
    const symptoms = await getSymptomsForMeal(meal.id);
    result.push({ ...meal, symptoms });
  }
  return result;
}

// ── Symptom helpers ──────────────────────────────────────────────────────────

export async function insertSymptom(symptom: Omit<Symptom, 'id'>): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO symptoms (meal_id, date, logged_at, description, severity, gaviscon_tsp) VALUES (?, ?, ?, ?, ?, ?)`,
    symptom.meal_id ?? null, symptom.date, symptom.logged_at, symptom.description, symptom.severity, symptom.gaviscon_tsp ?? 0
  );
  return result.lastInsertRowId;
}

export async function getGavisconTspForDate(date: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(s.gaviscon_tsp), 0) AS total
     FROM symptoms s
     JOIN meals m ON s.meal_id = m.id
     WHERE m.date = ?`,
    date
  );
  return row?.total ?? 0;
}

export async function getSymptomsForMeal(mealId: number): Promise<Symptom[]> {
  const db = await getDb();
  return db.getAllAsync<Symptom>(
    `SELECT * FROM symptoms WHERE meal_id = ? ORDER BY logged_at ASC`,
    mealId
  );
}

export async function getSymptomsForDate(date: string): Promise<Symptom[]> {
  const db = await getDb();
  return db.getAllAsync<Symptom>(
    `SELECT * FROM symptoms WHERE date = ? ORDER BY logged_at ASC`,
    date
  );
}

export async function deleteSymptom(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM symptoms WHERE id = ?`, id);
}

// ── Day detail (full) ────────────────────────────────────────────────────────

export async function getDayDetail(date: string): Promise<DayDetail | null> {
  const day = await getDay(date);
  if (!day) return null;

  const toilet_sessions = await getToiletSessions(date);
  const rawMeals = await getMealsForDate(date);
  const meals: MealWithSymptoms[] = await Promise.all(
    rawMeals.map(async m => ({
      ...m,
      symptoms: await getSymptomsForMeal(m.id),
    }))
  );
  const allSymptoms = await getSymptomsForDate(date);

  return { ...day, toilet_sessions, meals, symptoms: allSymptoms };
}

// ── Food history ─────────────────────────────────────────────────────────────

export interface FoodHistoryEntry {
  meal: Meal;
  symptoms: Symptom[];
}

export async function getFoodHistory(mealName: string): Promise<FoodHistoryEntry[]> {
  const db = await getDb();
  const meals = await db.getAllAsync<Meal>(
    `SELECT * FROM meals WHERE LOWER(name) LIKE LOWER(?) ORDER BY logged_at DESC`,
    `%${mealName}%`
  );
  return Promise.all(
    meals.map(async meal => ({
      meal,
      symptoms: await getSymptomsForMeal(meal.id),
    }))
  );
}

export async function getDistinctMealNames(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT DISTINCT name FROM meals ORDER BY name ASC`
  );
  return rows.map(r => r.name);
}

// ── Meal photo helpers ────────────────────────────────────────────────────────

export async function insertMealPhoto(mealId: number, photoUri: string, sortOrder = 0): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO meal_photos (meal_id, photo_uri, sort_order) VALUES (?, ?, ?)`,
    mealId, photoUri, sortOrder
  );
}

export async function getMealPhotos(mealId: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ photo_uri: string }>(
    `SELECT photo_uri FROM meal_photos WHERE meal_id = ? ORDER BY sort_order ASC`,
    mealId
  );
  return rows.map(r => r.photo_uri);
}

export async function deleteMealPhoto(mealId: number, photoUri: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM meal_photos WHERE meal_id = ? AND photo_uri = ?`,
    mealId, photoUri
  );
}
