export const TOPICS = [
  'ai',
  'dev',
  'gadgets',
  'startups',
  'security',
  'science',
  'space',
  'bio',
] as const;

export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<Topic, string> = {
  ai: 'AI',
  dev: 'Dev',
  gadgets: 'Gadgets',
  startups: 'Startups',
  security: 'Security',
  science: 'Science',
  space: 'Space',
  bio: 'Bio',
};

export function isTopic(value: string): value is Topic {
  return (TOPICS as readonly string[]).includes(value);
}
