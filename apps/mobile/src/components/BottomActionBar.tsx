import type { Card as CardData } from '@techtok/shared';
import { Link } from 'expo-router';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { BookmarkButton } from './BookmarkButton';

/** Base bar height, excluding the bottom safe-area inset (D25). */
export const ACTION_BAR_HEIGHT = 56;

export interface BottomActionBarProps {
  /** The card currently in view in the feed pager — drives the per-card
   * bookmark/share actions. Undefined only before the very first card has
   * loaded (see FeedScreen). */
  activeCard: CardData | undefined;
}

/**
 * Solid, layout-reserving bottom bar (DESIGN §2 D25) replacing the old
 * scattered overlay circle buttons: per-card actions (bookmark, share) for
 * whichever card is currently in view, plus global nav (saved, history,
 * settings) — all in one row.
 */
export function BottomActionBar({ activeCard }: BottomActionBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { height: ACTION_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.side}>
        {activeCard ? (
          <>
            <BookmarkButton postId={activeCard.id} isBookmarked={activeCard.isBookmarked} />
            <Pressable
              style={styles.button}
              hitSlop={8}
              onPress={() =>
                Share.share({
                  title: activeCard.title,
                  url: activeCard.url,
                  message:
                    Platform.OS === 'android'
                      ? `${activeCard.title}\n${activeCard.url}`
                      : activeCard.title,
                })
              }
            >
              <Text style={styles.icon}>↗</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      <View style={styles.side}>
        <Link href="/saved" style={styles.button}>
          <Text style={styles.icon}>🔖</Text>
        </Link>
        <Link href="/history" style={styles.button}>
          <Text style={styles.icon}>🕓</Text>
        </Link>
        <Link href="/settings" style={styles.button}>
          <Text style={styles.icon}>⚙</Text>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: Colors.overlay.surfaceBlack,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  icon: {
    fontSize: 20,
    color: Colors.overlay.text,
  },
});
