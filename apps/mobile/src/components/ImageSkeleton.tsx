import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

const PULSE_DURATION_MS = 800;

export function ImageSkeleton() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[StyleSheet.absoluteFill, styles.shimmer, { opacity }]} />;
}

const styles = StyleSheet.create({
  shimmer: {
    backgroundColor: Colors.overlay.surfaceDim,
  },
});
