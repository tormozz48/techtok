/**
 * Shared constants for the privacy policy and account-deletion pages.
 *
 * These pages are deliberately **English-only** (D75 / phase 23 track B):
 * machine-translating legal text into ru/uk/pl is a liability, not a feature,
 * so all four locales link to the same English document.
 */

/**
 * Contact address published on both legal pages.
 *
 * ⚠️ PLACEHOLDER — this must be replaced with a real, monitored address
 * before the Play listing is submitted. Play rejects a privacy policy whose
 * contact route does not work, and GDPR Art. 13 requires a reachable
 * controller contact. `.invalid` is reserved by RFC 2606 precisely so a
 * placeholder can never accidentally resolve to someone's real inbox.
 */
export const CONTACT_EMAIL = 'privacy@example.invalid';

/** Date the legal documents were last substantively changed. */
export const LEGAL_LAST_UPDATED = '13 August 2026';

/** Where the service runs — named in the policy because it is a transfer fact. */
export const HOSTING_REGION = 'eu-central-1 (Frankfurt, Germany)';
