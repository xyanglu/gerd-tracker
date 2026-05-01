import { MealWithSymptoms, Symptom, Day, DayDetail } from '../types';
import { formatDurationSec } from './dateUtils';
import { parseISO, differenceInMinutes } from 'date-fns';

export interface FoodTriggerStats {
  name: string;
  timesEaten: number;
  timesWithSymptoms: number;
  triggerRate: number; // 0–1
  avgOnsetMinutes: number | null;
  avgSeverity: number | null;
  maxSeverity: number;
  commonSymptoms: string[];
  safe: boolean; // eaten ≥2 times, never caused symptoms
}

export interface DailyMetricSummary {
  date: string;
  water_ml: number;
  metamucil: number;
  gaviscon_doses: number;
  totalSymptoms: number;
  avgSeverity: number | null;
  mealCount: number;
}

/** Group meals by name (case-insensitive) and compute trigger stats */
export function computeFoodTriggerStats(meals: MealWithSymptoms[]): FoodTriggerStats[] {
  const grouped: Record<string, MealWithSymptoms[]> = {};

  for (const meal of meals) {
    const key = meal.name.toLowerCase().trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(meal);
  }

  const stats: FoodTriggerStats[] = [];

  for (const [, group] of Object.entries(grouped)) {
    const displayName = group[0].name;
    const timesEaten = group.length;
    const mealsWithSymptoms = group.filter(m => m.symptoms.length > 0);
    const timesWithSymptoms = mealsWithSymptoms.length;
    const triggerRate = timesEaten > 0 ? timesWithSymptoms / timesEaten : 0;

    // Onset times: minutes from meal logged_at to first symptom
    const onsetMinutes: number[] = [];
    const severities: number[] = [];
    const symptomTexts: string[] = [];

    for (const meal of group) {
      const mealTime = parseISO(meal.logged_at);
      for (const s of meal.symptoms) {
        const symptomTime = parseISO(s.logged_at);
        const mins = differenceInMinutes(symptomTime, mealTime);
        if (mins >= 0 && mins <= 360) onsetMinutes.push(mins); // within 6h
        severities.push(s.severity);
        symptomTexts.push(s.description.toLowerCase().trim());
      }
    }

    const avgOnsetMinutes = onsetMinutes.length > 0
      ? Math.round(onsetMinutes.reduce((a, b) => a + b, 0) / onsetMinutes.length)
      : null;

    const avgSeverity = severities.length > 0
      ? Math.round((severities.reduce((a, b) => a + b, 0) / severities.length) * 10) / 10
      : null;

    const maxSeverity = severities.length > 0 ? Math.max(...severities) : 0;

    // Top 3 most common symptom phrases
    const freq: Record<string, number> = {};
    for (const t of symptomTexts) {
      freq[t] = (freq[t] ?? 0) + 1;
    }
    const commonSymptoms = Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([text]) => text);

    stats.push({
      name: displayName,
      timesEaten,
      timesWithSymptoms,
      triggerRate,
      avgOnsetMinutes,
      avgSeverity,
      maxSeverity,
      commonSymptoms,
      safe: timesEaten >= 2 && timesWithSymptoms === 0,
    });
  }

  // Sort: highest trigger rate first, then by times eaten desc
  return stats.sort((a, b) => {
    if (b.triggerRate !== a.triggerRate) return b.triggerRate - a.triggerRate;
    return b.timesEaten - a.timesEaten;
  });
}

export function formatOnset(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Build a rich plain-text context block for the LLM */
export function buildLLMContext(meals: MealWithSymptoms[]): string {
  if (meals.length === 0) return 'No meal or symptom data logged yet.';

  const lines: string[] = [];
  lines.push('## Meal & symptom log (chronological)\n');

  // Group by date
  const byDate: Record<string, MealWithSymptoms[]> = {};
  for (const m of meals) {
    if (!byDate[m.date]) byDate[m.date] = [];
    byDate[m.date].push(m);
  }

  for (const date of Object.keys(byDate).sort().reverse().slice(0, 30)) {
    lines.push(`### ${date}`);
    for (const meal of byDate[date].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
      const mealTime = parseISO(meal.logged_at);
      lines.push(`- **${formatLocalTime(meal.logged_at)}** — ${meal.name}${meal.description ? ` (${meal.description})` : ''}`);
      if (meal.symptoms.length === 0) {
        lines.push('  - No symptoms');
      } else {
        for (const s of meal.symptoms) {
          const onset = differenceInMinutes(parseISO(s.logged_at), mealTime);
          lines.push(
            `  - ${formatLocalTime(s.logged_at)} (+${formatOnset(onset)}) — ${s.description} [severity ${s.severity}/5]`
          );
        }
      }
    }
    lines.push('');
  }

  lines.push('\n## Food trigger summary\n');
  const stats = computeFoodTriggerStats(meals);
  for (const s of stats.slice(0, 20)) {
    const rate = Math.round(s.triggerRate * 100);
    const onset = s.avgOnsetMinutes != null ? `, avg onset ${formatOnset(s.avgOnsetMinutes)}` : '';
    const sev = s.avgSeverity != null ? `, avg severity ${s.avgSeverity}/5` : '';
    lines.push(`- ${s.name}: eaten ${s.timesEaten}×, symptoms ${s.timesWithSymptoms}× (${rate}%)${onset}${sev}`);
  }

  return lines.join('\n');
}

function formatLocalTime(iso: string): string {
  const d = parseISO(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Context for the intra-day agent: full detail for today only */
export function buildTodayContext(dayDetail: DayDetail): string {
  const lines: string[] = [];
  lines.push(`## Today: ${dayDetail.date}\n`);

  lines.push('### Daily metrics');
  lines.push(`- Water: ${dayDetail.water_ml} mL`);
  lines.push(`- Metamucil: ${dayDetail.metamucil ? 'taken' : 'not taken'}`);
  lines.push(`- Gaviscon doses: ${dayDetail.gaviscon_doses}`);
  lines.push('');

  const completedSessions = dayDetail.toilet_sessions.filter(s => s.duration_seconds !== null);
  if (completedSessions.length > 0) {
    const totalSec = completedSessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    lines.push('### Bathroom sessions');
    for (const s of completedSessions) {
      lines.push(`- ${formatLocalTime(s.start_time)} — ${formatDurationSec(s.duration_seconds!)}`);
    }
    lines.push(`Total: ${formatDurationSec(totalSec)}`);
    lines.push('');
  }

  lines.push('### Meals & symptoms (chronological)');
  const sortedMeals = [...dayDetail.meals].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  if (sortedMeals.length === 0) {
    lines.push('No meals logged yet today.');
  } else {
    for (const meal of sortedMeals) {
      const mealTime = parseISO(meal.logged_at);
      lines.push(
        `- **${formatLocalTime(meal.logged_at)}** — ${meal.name}` +
        `${meal.description ? ` (${meal.description})` : ''}` +
        `${meal.gaviscon_doses > 0 ? ` [${meal.gaviscon_doses} Gaviscon at meal]` : ''}`
      );
      if (meal.symptoms.length === 0) {
        lines.push('  - No symptoms logged');
      } else {
        for (const s of meal.symptoms) {
          const onset = differenceInMinutes(parseISO(s.logged_at), mealTime);
          lines.push(
            `  - ${formatLocalTime(s.logged_at)} (+${formatOnset(onset)}) — ${s.description}` +
            ` [severity ${s.severity}/5]` +
            `${s.gaviscon_tsp > 0 ? ` [${s.gaviscon_tsp} tsp Gaviscon]` : ''}`
          );
        }
      }
    }
  }

  return lines.join('\n');
}

/** Context for the multi-day trends agent: aggregated history + daily metrics */
export function buildTrendsContext(meals: MealWithSymptoms[], days: Day[]): string {
  if (meals.length === 0) return 'No meal or symptom data logged yet.';

  const lines: string[] = [];

  if (days.length > 0) {
    lines.push('## Daily metrics summary (recent days)\n');
    const recentDays = [...days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
    for (const d of recentDays) {
      const dayMeals = meals.filter(m => m.date === d.date);
      const symptoms = dayMeals.flatMap(m => m.symptoms);
      const avgSev = symptoms.length > 0
        ? Math.round(symptoms.reduce((s, x) => s + x.severity, 0) / symptoms.length * 10) / 10
        : null;
      lines.push(
        `- ${d.date}: water ${d.water_ml}mL, metamucil ${d.metamucil ? 'yes' : 'no'},` +
        ` gaviscon ${d.gaviscon_doses} doses, ${dayMeals.length} meals, ${symptoms.length} symptoms` +
        `${avgSev !== null ? `, avg severity ${avgSev}/5` : ''}`
      );
    }
    lines.push('');
  }

  lines.push('## Meal & symptom log (chronological)\n');
  const byDate: Record<string, MealWithSymptoms[]> = {};
  for (const m of meals) {
    if (!byDate[m.date]) byDate[m.date] = [];
    byDate[m.date].push(m);
  }
  for (const date of Object.keys(byDate).sort().reverse().slice(0, 30)) {
    lines.push(`### ${date}`);
    for (const meal of byDate[date].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
      const mealTime = parseISO(meal.logged_at);
      lines.push(`- **${formatLocalTime(meal.logged_at)}** — ${meal.name}${meal.description ? ` (${meal.description})` : ''}`);
      if (meal.symptoms.length === 0) {
        lines.push('  - No symptoms');
      } else {
        for (const s of meal.symptoms) {
          const onset = differenceInMinutes(parseISO(s.logged_at), mealTime);
          lines.push(`  - ${formatLocalTime(s.logged_at)} (+${formatOnset(onset)}) — ${s.description} [severity ${s.severity}/5]`);
        }
      }
    }
    lines.push('');
  }

  lines.push('\n## Food trigger summary\n');
  const stats = computeFoodTriggerStats(meals);
  for (const s of stats.slice(0, 20)) {
    const rate = Math.round(s.triggerRate * 100);
    const onset = s.avgOnsetMinutes != null ? `, avg onset ${formatOnset(s.avgOnsetMinutes)}` : '';
    const sev = s.avgSeverity != null ? `, avg severity ${s.avgSeverity}/5` : '';
    lines.push(`- ${s.name}: eaten ${s.timesEaten}×, symptoms ${s.timesWithSymptoms}× (${rate}%)${onset}${sev}`);
  }

  return lines.join('\n');
}
