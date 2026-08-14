import type { Card as CardData } from '@techtok/shared';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { useStrings } from '@/i18n/useStrings';
import { useSpeechStore } from '@/state/speechStore';
import { BookmarkButton } from './BookmarkButton';

/** Base bar height, excluding the bottom safe-area inset (D25). */
export const ACTION_BAR_HEIGHT = 56;

export interface BottomActionBarProps {
  /** The card currently in view in the feed pager — drives the per-card
   * bookmark/share actions. Undefined only before the very first card has
   * loaded (see FeedScreen). */
  activeCard: CardData | undefined;
  /** Resets the feed back to the newest page (A1) — PagerView has no
   * RefreshControl, so this is the only manual-refresh affordance. */
  onRefresh: () => void;
}

/**
 * Solid, layout-reserving bottom bar (DESIGN §2 D25) replacing the old
 * scattered overlay circle buttons: per-card actions (bookmark, share) for
 * whichever card is currently in view, plus global nav (saved, history,
 * settings) — all in one row.
 */
export function BottomActionBar({ activeCard, onRefresh }: BottomActionBarProps) {
  const insets = useSafeAreaInsets();
  const strings = useStrings();
  const isSpeakingThisCard = useSpeechStore((state) =>
    activeCard ? state.isSpeaking(activeCard.id) : false,
  );
  const isLanguageAvailable = useSpeechStore((state) =>
    activeCard ? state.isLanguageAvailable(activeCard.servedLang) : false,
  );

  useEffect(() => {
    useSpeechStore.getState().checkVoiceAvailability();
  }, []);

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
            <BookmarkButton
              postId={activeCard.id}
              isBookmarked={activeCard.isBookmarked}
              style={styles.icon}
              testID="action-bar-bookmark"
              snapshot={{
                cardTitle: activeCard.title,
                sourceName: activeCard.sourceName,
                url: activeCard.url,
                primaryTopic: activeCard.primaryTopic,
              }}
            />
            <IconButton
              icon="share-variant"
              iconColor={Colors.overlay.text}
              size={20}
              style={styles.icon}
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
              accessibilityLabel={strings.a11y.share}
            />
            {isLanguageAvailable ? (
              <IconButton
                icon={isSpeakingThisCard ? 'volume-off' : 'volume-high'}
                iconColor={Colors.overlay.text}
                size={20}
                style={styles.icon}
                accessibilityLabel={
                  isSpeakingThisCard ? strings.speech.stopListening : strings.speech.listen
                }
                onPress={() => {
                  const speech = useSpeechStore.getState();
                  if (isSpeakingThisCard) {
                    speech.stop();
                  } else {
                    speech.speak(
                      activeCard.id,
                      [activeCard.title, activeCard.summary],
                      activeCard.servedLang,
                    );
                  }
                }}
              />
            ) : null}
          </>
        ) : null}
      </View>
      <View style={styles.side}>
        <IconButton
          icon="refresh"
          iconColor={Colors.overlay.text}
          size={20}
          style={styles.icon}
          onPress={onRefresh}
          accessibilityLabel="Refresh feed"
          testID="action-bar-refresh"
        />
        <Link href="/saved" asChild>
          <IconButton
            icon="bookmark-multiple-outline"
            iconColor={Colors.overlay.text}
            size={20}
            style={styles.icon}
            accessibilityLabel={strings.a11y.openSaved}
            testID="action-bar-saved"
          />
        </Link>
        <Link href="/history" asChild>
          <IconButton
            icon="history"
            iconColor={Colors.overlay.text}
            size={20}
            style={styles.icon}
            accessibilityLabel={strings.a11y.openHistory}
            testID="action-bar-history"
          />
        </Link>
        <Link href="/settings" asChild>
          <IconButton
            icon="cog-outline"
            iconColor={Colors.overlay.text}
            size={20}
            style={styles.icon}
            accessibilityLabel={strings.a11y.openSettings}
            testID="action-bar-settings"
          />
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
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  icon: {
    margin: 0,
  },
});
