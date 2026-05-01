import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { colors } from '../utils/colors';
import { insertMeal, insertMealPhoto, getDistinctMealNames } from '../db/database';
import { nowISO, todayString } from '../utils/dateUtils';

export function LogMealScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const date: string = route.params?.date ?? todayString();

  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [allMealNames, setAllMealNames] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDistinctMealNames().then(setAllMealNames);
  }, []);

  const suggestions = name.trim().length > 0
    ? allMealNames
        .filter(n => n.toLowerCase().includes(name.toLowerCase()) && n.toLowerCase() !== name.toLowerCase())
        .slice(0, 5)
    : [];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach food photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await savePhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take food photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      await savePhoto(result.assets[0].uri);
    }
  };

  const savePhoto = async (uri: string) => {
    const dir = `${FileSystem.documentDirectory}meals/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const filename = `meal_${Date.now()}.jpg`;
    const dest = `${dir}${filename}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    setPhotoUris(prev => [...prev, dest]);
  };

  const removePhoto = (index: number) => {
    setPhotoUris(prev => prev.filter((_, i) => i !== index));
  };

  const showPhotoOptions = () => {
    Alert.alert('Add photo', '', [
      { text: 'Take photo', onPress: takePhoto },
      { text: 'Choose from library', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter what you ate.');
      return;
    }
    setSaving(true);
    try {
      const id = await insertMeal({
        date,
        logged_at: nowISO(),
        name: name.trim(),
        description: description.trim() || null,
        photo_uri: photoUris[0] ?? null,
        gaviscon_doses: 0,
      });
      for (let i = 0; i < photoUris.length; i++) {
        await insertMealPhoto(id, photoUris[i], i);
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>What did you eat?</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Grilled chicken, tomato sauce pasta…"
        placeholderTextColor={colors.textDisabled}
        value={name}
        onChangeText={setName}
        onFocus={() => setNameFocused(true)}
        onBlur={() => setTimeout(() => setNameFocused(false), 150)}
        autoFocus
      />
      {nameFocused && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map(s => (
            <TouchableOpacity
              key={s}
              style={styles.suggestion}
              onPress={() => { setName(s); setNameFocused(false); }}
            >
              <Ionicons name="time-outline" size={14} color={colors.textDisabled} style={styles.suggestionIcon} />
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Portion size, ingredients, restaurant…"
        placeholderTextColor={colors.textDisabled}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <Text style={styles.label}>Photos (optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow} contentContainerStyle={styles.photoRowContent}>
        {photoUris.map((uri, i) => (
          <View key={i} style={styles.thumbWrapper}>
            <Image source={{ uri }} style={styles.thumb} />
            <TouchableOpacity style={styles.thumbRemove} onPress={() => removePhoto(i)}>
              <Ionicons name="close-circle" size={22} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addPhotoBtn} onPress={showPhotoOptions}>
          <Ionicons name="camera" size={26} color={colors.textSecondary} />
          <Text style={styles.addPhotoBtnText}>{photoUris.length === 0 ? 'Add photo' : 'Add more'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={save}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.saveBtnText}> Save meal</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  multiline: { minHeight: 80 },
  suggestions: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
    marginTop: -1,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  suggestionIcon: { flexShrink: 0 },
  suggestionText: { fontSize: 14, color: colors.textPrimary },
  photoRow: { marginTop: 4 },
  photoRowContent: { gap: 10, paddingVertical: 4 },
  thumbWrapper: { position: 'relative' },
  thumb: { width: 90, height: 90, borderRadius: 10 },
  thumbRemove: { position: 'absolute', top: -6, right: -6 },
  addPhotoBtn: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surface,
  },
  addPhotoBtnText: { color: colors.textSecondary, fontSize: 11 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
