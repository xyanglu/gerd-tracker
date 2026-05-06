import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
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

  // Meal time state — defaults to now, overridden by photo timestamp
  const [mealTime, setMealTime] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeFromPhoto, setTimeFromPhoto] = useState(false);

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

  /** Extract the photo's creation timestamp via MediaLibrary and save locally */
  const savePhoto = async (uri: string) => {
    const dir = `${FileSystem.documentDirectory}meals/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const filename = `meal_${Date.now()}.jpg`;
    const dest = `${dir}${filename}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    setPhotoUris(prev => [...prev, dest]);

    // Try to get the photo's original timestamp from MediaLibrary
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return;

      const asset = await MediaLibrary.getAssetInfoAsync(uri);
      if (asset && asset.creationTime) {
        const photoDate = new Date(asset.creationTime);
        // Only use the first photo's timestamp
        setMealTime(prev => {
          // If no photo timestamp set yet, or this is the first photo
          if (!timeFromPhoto) {
            setTimeFromPhoto(true);
            return photoDate;
          }
          return prev;
        });
      }
    } catch {
      // Silently fall back to current time if MediaLibrary fails
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUris(prev => prev.filter((_, i) => i !== index));
    // If all photos removed, reset time to now
    if (photoUris.length <= 1) {
      setMealTime(new Date());
      setTimeFromPhoto(false);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('Add photo', '', [
      { text: 'Take photo', onPress: takePhoto },
      { text: 'Choose from library', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onTimeChange = (_event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios'); // iOS stays open until dismissed
    if (selectedTime) {
      setMealTime(selectedTime);
      setTimeFromPhoto(false); // user manually overrode
    }
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter what you ate.');
      return;
    }
    setSaving(true);
    try {
      const loggedAt = mealTime.toISOString();
      const mealDate = format(mealTime, 'yyyy-MM-dd');
      const id = await insertMeal({
        date: mealDate,
        logged_at: loggedAt,
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

  const timeLabel = format(mealTime, 'h:mm a');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Meal Time */}
      <Text style={styles.label}>Meal time</Text>
      <TouchableOpacity
        style={styles.timeRow}
        onPress={() => setShowTimePicker(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="time-outline" size={18} color={colors.primary} />
        <Text style={styles.timeValue}>{timeLabel}</Text>
        {timeFromPhoto && (
          <Text style={styles.timeBadge}>from photo</Text>
        )}
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={styles.timeChevron} />
      </TouchableOpacity>
      {showTimePicker && (
        <DateTimePicker
          value={mealTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
          minuteInterval={5}
        />
      )}

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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  timeValue: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  timeBadge: {
    fontSize: 11,
    color: colors.primary,
    backgroundColor: `${colors.primary}18`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    fontWeight: '600',
  },
  timeChevron: {
    marginLeft: 'auto',
  },
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
