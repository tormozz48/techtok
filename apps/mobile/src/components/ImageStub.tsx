import type { Topic } from '@techtok/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { TopicMascot } from './TopicMascot';

export interface ImageStubProps {
  postId: string;
  topic: Topic;
}

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

export function ImageStub({ postId, topic }: ImageStubProps) {
  const [start, end] = gradientForPostId(postId);

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[start, end]} style={StyleSheet.absoluteFill} />
      <View style={styles.mascotWrapper}>
        <TopicMascot topic={topic} size={140} opacity={0.85} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mascotWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
