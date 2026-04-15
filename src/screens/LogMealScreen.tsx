import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { colors } from '../utils/colors';
import { insertMeal } from '../db/database';
import { nowISO, todayString } from '../utils/dateUtils';

export function LogMealScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const date: string = route.params?.date ?? todayString();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [gavisconDoses, setGavisconDoses] = useState(0);
  const [saving, setSaving] = useState(false);

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
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
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
    setPhotoUri(dest);
  };

  const removePhoto = () => setPhotoUri(null);

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
        photo_uri: photoUri,
        gaviscon_doses: gavisconDoses,
      });
      navigation.navigate('MealDetail', { mealId: id });
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
        autoFocus
      />

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

      <Text style={styles.label}>Gaviscon doses (optional)</Text>
      <View style={styles.gavisconRow}>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => setGavisconDoses(d => Math.max(0, d - 1))}
        >
          <Ionicons name="remove" size={20} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.counterVal}>{gavisconDoses}</Text>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => setGavisconDoses(d => d + 1)}
        >
          <Ionicons name="add" size={20} color={colors.accent} />
        </TouchableOpacity>
        {gavisconDoses > 0 && (
          <Text style={styles.gavisconHint}>dose{gavisconDoses !== 1 ? 's' : ''} taken with this meal</Text>
        )}
      </View>

      <Text style={styles.label}>Photo (optional)</Text>
      {photoUri ? (
        <View>
          <Image source={{ uri: photoUri }} style={styles.preview} />
          <TouchableOpacity style={styles.removePhoto} onPress={removePhoto}>
            <Ionicons name="close-circle" size={28} color={colors.danger} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.photoBtn} onPress={showPhotoOptions}>
          <Ionicons name="camera" size={28} color={colors.textSecondary} />
          <Text style={styles.photoBtnText}>Add food photo</Text>
        </TouchableOpacity>
      )}

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
  photoBtn: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoBtnText: { color: colors.textSecondary, fontSize: 14 },
  preview: { width: '100%', height: 200, borderRadius: 10 },
  removePhoto: { position: 'absolute', top: 8, right: 8 },
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
  gavisconRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.accentLight },
  counterVal: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, minWidth: 28, textAlign: 'center' },
  gavisconHint: { fontSize: 13, color: colors.textSecondary, flex: 1 },
});
