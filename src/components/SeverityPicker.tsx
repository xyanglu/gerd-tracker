import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, severityColor, severityLabel } from '../utils/colors';

interface Props {
  value: number;
  onChange: (v: number) => void;
}

export function SeverityPicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map(n => {
        const selected = value === n;
        const bg = severityColor(n);
        return (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            style={[
              styles.btn,
              { backgroundColor: selected ? bg : '#F5F5F5', borderColor: bg },
            ]}
          >
            <Text style={[styles.num, { color: selected ? '#fff' : bg }]}>{n}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { fontWeight: '700', fontSize: 15 },
});
