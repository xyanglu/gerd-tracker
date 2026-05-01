import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../utils/colors';
import { streamChat, getStoredApiKey, AgentType, ChatMessage } from '../services/claudeService';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  streaming?: boolean;
}

const SUGGESTIONS: Record<AgentType, string[]> = {
  today: [
    'How long after eating did my symptoms start today?',
    'Which meal today seems to be causing problems?',
    'How does my water intake look today?',
    'Summarize my day so far.',
  ],
  trends: [
    'Which foods trigger my symptoms most often?',
    'What are my safest foods based on history?',
    'Do I have more symptoms on days I skip Metamucil?',
    'What patterns do you see over the past month?',
  ],
};

function toHistory(messages: Message[]): ChatMessage[] {
  return messages
    .filter(m => !m.streaming && m.role !== 'error')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.text }));
}

export function AskAIScreen() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AgentType>('today');
  const [todayMessages, setTodayMessages] = useState<Message[]>([]);
  const [trendsMessages, setTrendsMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);
  const streamingIdRef = useRef<string | null>(null);

  useFocusEffect(useCallback(() => {
    getStoredApiKey().then(k => setHasKey(!!k));
  }, []));

  const messages = activeTab === 'today' ? todayMessages : trendsMessages;
  const setMessages = activeTab === 'today' ? setTodayMessages : setTrendsMessages;

  const switchTab = (tab: AgentType) => {
    if (tab === activeTab || loading) return;
    setActiveTab(tab);
    setInput('');
  };

  if (hasKey === null) return null;

  if (!hasKey) {
    return (
      <View style={styles.noKeyContainer}>
        <Ionicons name="key-outline" size={48} color={colors.textDisabled} />
        <Text style={styles.noKeyTitle}>API key needed</Text>
        <Text style={styles.noKeyBody}>
          Add your Anthropic API key in Settings to enable AI chat.{'\n\n'}
          Cost estimate: &lt;$0.01/day at typical usage (uses claude-haiku).
        </Text>
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}
        >
          <Ionicons name="open-outline" size={16} color={colors.primary} />
          <Text style={styles.linkBtnText}> Get API key</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');
    setLoading(true);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    const aiId = (Date.now() + 1).toString();
    const aiMsg: Message = { id: aiId, role: 'assistant', text: '', streaming: true };
    streamingIdRef.current = aiId;

    const currentHistory = toHistory(messages);
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    await streamChat(
      activeTab,
      currentHistory,
      text,
      (delta) => {
        setMessages(prev =>
          prev.map(m => m.id === aiId ? { ...m, text: m.text + delta } : m)
        );
      },
      () => {
        setMessages(prev =>
          prev.map(m => m.id === aiId ? { ...m, streaming: false } : m)
        );
        setLoading(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      },
      (errMsg) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === aiId ? { ...m, text: errMsg, role: 'error', streaming: false } : m
          )
        );
        setLoading(false);
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Tab switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'today' && styles.tabActive]}
          onPress={() => switchTab('today')}
        >
          <Ionicons
            name="today-outline"
            size={15}
            color={activeTab === 'today' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'today' && styles.tabTextActive]}>
            {' '}Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'trends' && styles.tabActive]}
          onPress={() => switchTab('trends')}
        >
          <Ionicons
            name="trending-up-outline"
            size={15}
            color={activeTab === 'trends' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'trends' && styles.tabTextActive]}>
            {' '}Trends
          </Text>
        </TouchableOpacity>
      </View>

      {messages.length === 0 ? (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsTitle}>
            {activeTab === 'today' ? "Ask about today's activity" : 'Ask about your patterns'}
          </Text>
          {SUGGESTIONS[activeTab].map(s => (
            <TouchableOpacity key={s} style={styles.suggestionBtn} onPress={() => send(s)}>
              <Text style={styles.suggestionText}>{s}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          ))}
          <Text style={styles.poweredBy}>Powered by Claude Haiku · your data stays on-device</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => <MessageBubble message={item} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={activeTab === 'today' ? "Ask about today…" : "Ask about trends…"}
          placeholderTextColor={colors.textDisabled}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          editable={!loading}
          returnKeyType="send"
          onSubmitEditing={() => send(input)}
          blurOnSubmit
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={18} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
      {message.streaming && message.text === '' ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Text style={[
          styles.bubbleText,
          isUser && styles.bubbleTextUser,
          isError && styles.bubbleTextError,
        ]}>
          {message.text}
          {message.streaming ? '▌' : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  noKeyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  noKeyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  noKeyBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  linkBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  suggestions: { flex: 1, padding: 20, justifyContent: 'center', gap: 10 },
  suggestionsTitle: { fontSize: 16, fontWeight: '700', color: colors.textSecondary, marginBottom: 4, textAlign: 'center' },
  suggestionBtn: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border,
  },
  suggestionText: { flex: 1, fontSize: 14, color: colors.textPrimary },
  poweredBy: { fontSize: 11, color: colors.textDisabled, textAlign: 'center', marginTop: 12 },
  messageList: { padding: 16, gap: 10 },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: 12, marginBottom: 6 },
  bubbleUser: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: colors.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextError: { color: colors.danger },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1, backgroundColor: colors.background, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: colors.textPrimary, maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
