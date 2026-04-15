import Anthropic from '@anthropic-ai/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildLLMContext } from '../utils/analytics';
import { getAllMealsWithSymptoms } from '../db/database';

const API_KEY_STORAGE = 'anthropic_api_key';

export async function getStoredApiKey(): Promise<string | null> {
  return AsyncStorage.getItem(API_KEY_STORAGE);
}

export async function saveApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(API_KEY_STORAGE, key.trim());
}

export async function clearApiKey(): Promise<void> {
  await AsyncStorage.removeItem(API_KEY_STORAGE);
}

const SYSTEM_PROMPT = `You are a compassionate GERD (Gastroesophageal Reflux Disease) health assistant embedded in a personal tracking app. You help the user understand their symptom patterns, identify food triggers, and manage their condition day-to-day.

You have access to the user's full meal log, including:
- Exact timestamps when each food was eaten
- Timestamps when each symptom appeared and which meal it was linked to
- Time elapsed between eating and symptom onset
- Symptom severity (1–5 scale)
- Daily metrics: water intake, Metamucil, Gaviscon doses, toilet session durations

When answering:
- Reference specific foods, times, and elapsed durations from the data when relevant
- Be practical and specific, not generic
- Note patterns with confidence caveats when sample sizes are small
- Do NOT give medical diagnoses or replace medical advice — encourage the user to share findings with their doctor
- Keep responses concise and easy to read on a phone screen`;

export async function streamChat(
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
    const meals = await getAllMealsWithSymptoms();
    context = buildLLMContext(meals);
  } catch (e) {
    context = 'Could not load meal data.';
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  try {
    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is my current health log data:\n\n${context}\n\n---\n\n${userMessage}`,
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
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
