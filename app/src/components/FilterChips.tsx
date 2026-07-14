import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SERVICES, SERVICE_ORDER } from '../services/capabilities';
import { useTheme } from '../theme';
import { ServiceId } from '../types';

export type InboxFilter = 'all' | 'unread' | ServiceId;

interface Props {
  connected: ServiceId[];
  active: InboxFilter;
  onChange: (f: InboxFilter) => void;
}

export function FilterChips({ connected, active, onChange }: Props) {
  const t = useTheme();
  const chips: Array<{ key: InboxFilter; label: string; dot?: string }> = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    ...SERVICE_ORDER.filter((s) => connected.includes(s)).map((s) => ({
      key: s as InboxFilter,
      label: SERVICES[s].shortName,
      dot: SERVICES[s].brandColor,
    })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={{ flexGrow: 0 }}
    >
      {chips.map((chip) => {
        const isActive = active === chip.key;
        return (
          <Pressable
            key={chip.key}
            testID={`chip-${chip.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(chip.key)}
            style={[
              styles.chip,
              { backgroundColor: isActive ? t.chipActiveBg : t.chipBg },
            ]}
          >
            {chip.dot && <View style={[styles.dot, { backgroundColor: chip.dot }]} />}
            <Text
              style={[
                styles.label,
                { color: isActive ? t.chipActiveText : t.textSecondary },
              ]}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
