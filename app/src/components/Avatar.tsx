import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SERVICES } from '../services/capabilities';
import { ServiceId } from '../types';

interface Props {
  initials: string;
  color: string;
  size?: number;
  service?: ServiceId; // when set, renders the small brand-colored badge
}

export function Avatar({ initials, color, size = 48, service }: Props) {
  const badgeSize = Math.round(size * 0.42);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        ]}
      >
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
      </View>
      {service && (
        <View
          testID={`badge-${service}`}
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: SERVICES[service].brandColor,
            },
          ]}
        >
          <Text style={[styles.badgeGlyph, { fontSize: badgeSize * 0.52 }]}>
            {SERVICES[service].badgeGlyph}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeGlyph: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
