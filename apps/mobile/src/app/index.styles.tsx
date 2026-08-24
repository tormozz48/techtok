import { StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';

export const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fetchingIndicator: {
    position: 'absolute',
    top: Spacing.six,
    alignSelf: 'center',
  },
  quotaBadge: {
    position: 'absolute',
    top: Spacing.six,
    right: Spacing.three,
    gap: Spacing.half,
    alignItems: 'flex-end',
  },
});
