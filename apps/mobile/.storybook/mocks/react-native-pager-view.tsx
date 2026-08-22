import { Children, isValidElement, type ReactNode, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

export interface PagerViewOnPageSelectedEvent {
  nativeEvent: { position: number };
}

export interface PagerViewProps {
  children?: ReactNode;
  style?: unknown;
  orientation?: 'horizontal' | 'vertical';
  offscreenPageLimit?: number;
  initialPage?: number;
  onPageSelected?: (event: PagerViewOnPageSelectedEvent) => void;
  [key: string]: unknown;
}

export function PagerView({ children, style, onPageSelected }: PagerViewProps) {
  const [pageSize, setPageSize] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setPageSize(event.nativeEvent.layout.height);
  };

  const onMomentumScrollEnd = (event: { nativeEvent: NativeScrollEvent }) => {
    if (!pageSize) return;
    const position = Math.round(event.nativeEvent.contentOffset.y / pageSize);
    onPageSelected?.({ nativeEvent: { position } });
  };

  return (
    <ScrollView
      style={[styles.pager, style]}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      onLayout={onLayout}
      onMomentumScrollEnd={onMomentumScrollEnd}
    >
      {pageSize
        ? Children.map(children, (child, index) => (
            <View
              key={isValidElement(child) ? (child.key ?? index) : index}
              style={{ height: pageSize }}
            >
              {child}
            </View>
          ))
        : null}
    </ScrollView>
  );
}

export default PagerView;

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
});
