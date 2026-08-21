import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontWeight, Spacing, type ThemeColors, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useStrings } from '@/i18n/useStrings';
import { type BuildInfo as BuildInfoValue, describeBuild } from '@/utils/buildInfo';

type Props = {
  /** Injected by stories/tests; read from expo-updates otherwise. */
  value?: BuildInfoValue;
};

function readBuildInfo(): BuildInfoValue {
  return describeBuild({
    // Resolved from the *running* bundle's manifest, so after an OTA update
    // this is the pushed payload's app.json version, not the installed APK's.
    bundleVersion: Constants.expoConfig?.version,
    runtimeVersion: Updates.runtimeVersion,
    channel: Updates.channel,
    updateId: Updates.updateId,
    createdAt: Updates.createdAt,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  });
}

export function BuildInfo({ value }: Props) {
  const strings = useStrings();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const info = value ?? readBuildInfo();

  const rows: readonly [string, string][] = [
    [
      strings.build.source,
      info.source === 'ota' ? strings.build.sourceOta : strings.build.sourceEmbedded,
    ],
    [strings.build.bundleVersion, info.bundleVersion],
    [strings.build.updateId, info.updateId],
    [strings.build.publishedAt, info.publishedAt],
    [strings.build.channel, info.channel],
    [strings.build.runtimeVersion, info.runtimeVersion],
  ];

  return (
    <View testID={`build-info-${info.source}`}>
      <Text style={styles.sectionTitle}>{strings.build.sectionTitle}</Text>
      <View style={styles.card}>
        {rows.map(([label, valueText]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value} selectable>
              {valueText}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionTitle: {
      color: colors.textSecondary,
      ...Typography.sm,
      fontWeight: FontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.two,
    },
    card: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.three,
      paddingVertical: Spacing.one,
    },
    label: {
      color: colors.textSecondary,
      ...Typography.sm,
    },
    value: {
      color: colors.text,
      ...Typography.sm,
      fontWeight: FontWeight.semibold,
      flexShrink: 1,
      textAlign: 'right',
    },
  });
}
