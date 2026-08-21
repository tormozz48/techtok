/** Renders a quota `resetsAt` instant (D69's next local midnight) as a
 * device-locale wall-clock time. Shared by the paywall's exhausted banner and
 * the feed's own in-place quota block, which show the same value. */
export function formatResetTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
