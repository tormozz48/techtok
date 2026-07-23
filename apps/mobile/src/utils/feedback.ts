export const FEEDBACK_EMAIL = 'andrii@numica.com';

/**
 * Long-press-on-a-translation feedback mailto (phase 10 item 2): prefills
 * postId + lang so a report can be traced back to the specific translation
 * that reads wrong without the user typing anything. This is the data that
 * decides whether the deferred verify pass (DESIGN §12) gets built.
 */
export function translationFeedbackMailto(postId: string, lang: string): string {
  const subject = encodeURIComponent('TechTok translation feedback');
  const body = encodeURIComponent(
    `Post: ${postId}\nLanguage: ${lang}\n\nWhat's wrong with this translation?\n`,
  );
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
}
