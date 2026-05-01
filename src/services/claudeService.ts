import Anthropic from '@anthropic-ai/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildTodayContext, buildTrendsContext } from '../utils/analytics';
import { getAllMealsWithSymptoms, getAllDays, getDayDetail } from '../db/database';
import { todayString } from '../utils/dateUtils';

const API_KEY_STORAGE = 'anthropic_api_key';

export type AgentType = 'today' | 'trends';
export interface ChatMessage { role: 'user' | 'assistant'; content: string; }

export async function getStoredApiKey(): Promise<string | null> {
  return AsyncStorage.getItem(API_KEY_STORAGE);
}

export async function saveApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(API_KEY_STORAGE, key.trim());
}

export async function clearApiKey(): Promise<void> {
  await AsyncStorage.removeItem(API_KEY_STORAGE);
}

const TODAY_SYSTEM = `You are a GERD health assistant focused on today's activity. You have the user's complete log for today — exact meal times, symptoms with onset timing, water intake, medications, and bathroom sessions.

When answering:
- Reference specific times, foods, and elapsed durations from today's data
- Help the user understand what's happening right now or over the course of today
- Note if data is sparse (e.g. "only 2 meals logged so far today")
- Do NOT give medical diagnoses — encourage sharing findings with their doctor
- Keep responses concise and easy to read on a phone screen`;

const TRENDS_SYSTEM = `You are a GERD health assistant focused on multi-day patterns and trends. You have the user's full history — food trigger rates, symptom frequencies, and daily metrics over time.

When answering:
- Look for patterns across days, weeks, or the full history
- Highlight foods with high or low trigger rates, and note sample size
- Reference daily metric trends (water, Gaviscon, Metamucil) when relevant
- Be specific about timeframes ("over the last 2 weeks" vs "all time")
- Do NOT give medical diagnoses — encourage sharing findings with their doctor
- Keep responses concise and easy to read on a phone screen`;

export async function streamChat(
  agentType: AgentType,
  history: ChatMessage[],
  userMessage: string,
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  const apiKey = await getStoredApiKey();
  if (!apiKey) {
    onError('No API key set. Add your Anthropic API key in Settings → Ask AI.');
    return;
  }

  let context = '';
  try {
    if (agentType === 'today') {
      const detail = await getDayDetail(todayString());
      context = detail ? buildTodayContext(detail) : 'No data logged today yet.';
    } else {
      const [meals, days] = await Promise.all([getAllMealsWithSymptoms(), getAllDays()]);
      context = buildTrendsContext(meals, days);
    }
  } catch {
    context = 'Could not load health data.';
  }

  const systemPrompt = agentType === 'today' ? TODAY_SYSTEM : TRENDS_SYSTEM;
  const systemWithContext = `${systemPrompt}\n\n## Current health data:\n\n${context}`;

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  try {
    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemWithContext,
      messages: [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onDelta(event.delta.text);
      }
    }
    onDone();
  } catch (err: any) {
    if (err instanceof Anthropic.AuthenticationError) {
      onError('Invalid API key. Check your key in Settings → Ask AI.');
    } else if (err instanceof Anthropic.RateLimitError) {
      onError('Rate limit reached. Please wait a moment and try again.');
    } else {
      onError(err?.message ?? 'Unknown error calling Claude API.');
    }
  }
}
