import type { Topic } from '@techtok/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

export interface ImageStubProps {
  postId: string;
  topic: Topic;
}

/** Fixed, hand-picked palette — deliberately muted/cool tones so the glyph
 * and the card's text overlay both stay legible on top of any of them. */
const GRADIENT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['#3A1C71', '#6C3483'],
  ['#134E5E', '#71B280'],
  ['#0F2027', '#2C5364'],
  ['#1D2B64', '#5B247A'],
  ['#232526', '#414345'],
  ['#2C3E50', '#4CA1AF'],
  ['#42275A', '#734B6D'],
  ['#16222A', '#3A6073'],
];

const TOPIC_GLYPHS: Record<Topic, string> = {
  ai: '🤖',
  dev: '💻',
  gadgets: '📱',
  startups: '🚀',
  security: '🔒',
  science: '🔬',
  space: '🪐',
  bio: '🧬',
};

/** Cheap deterministic string hash (not cryptographic) — only needs to
 * spread postIds evenly across a small fixed palette, the same way every
 * time, on every device, with no network call. */
export function hashToIndex(value: string, modulus: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulus;
}

export function gradientForPostId(postId: string): readonly [string, string] {
  return GRADIENT_PAIRS[hashToIndex(postId, GRADIENT_PAIRS.length)];
}

/**
 * Client-side stand-in for posts with no image at all (DESIGN §2 D24):
 * zero assets, zero backend calls, works offline. The gradient is seeded by
 * postId so the same post always looks the same across renders/devices; the
 * glyph identifies its topic.
 */
export function ImageStub({ postId, topic }: ImageStubProps) {
  const [start, end] = gradientForPostId(postId);

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[start, end]} style={StyleSheet.absoluteFill} />
      <View style={styles.glyphWrapper}>
        <Text style={styles.glyph}>{TOPIC_GLYPHS[topic]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glyphWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 64,
    opacity: 0.35,
  },
});
