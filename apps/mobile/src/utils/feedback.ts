export const FEEDBACK_EMAIL = 'andrii@numica.com';

export function translationFeedbackMailto(postId: string, lang: string): string {
  const subject = encodeURIComponent('TechTok translation feedback');
  const body = encodeURIComponent(
    `Post: ${postId}\nLanguage: ${lang}\n\nWhat's wrong with this translation?\n`,
  );
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
}
