import { StyleSheet, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ImageSkeleton } from './ImageSkeleton';

/** Full-screen loading placeholder shaped like a Card, shown while the first feed page loads. */
export function FeedSkeleton() {
  return (
    <View style={styles.container}>
      <ImageSkeleton />
      <View style={styles.content}>
        <View style={[styles.block, styles.chip]} />
        <View style={[styles.block, styles.title]} />
        <View style={[styles.block, styles.titleShort]} />
        <View style={[styles.block, styles.summary]} />
        <View style={[styles.block, styles.summaryShort]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.overlay.surfaceBlack,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  block: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.sm,
  },
  chip: {
    width: 64,
    height: 20,
    borderRadius: Radius.pill,
    marginBottom: Spacing.three,
  },
  title: {
    width: '90%',
    height: 28,
    marginBottom: Spacing.two,
  },
  titleShort: {
    width: '60%',
    height: 28,
    marginBottom: Spacing.three,
  },
  summary: {
    width: '100%',
    height: 18,
    marginBottom: Spacing.two,
  },
  summaryShort: {
    width: '80%',
    height: 18,
    marginBottom: Spacing.three,
  },
});
