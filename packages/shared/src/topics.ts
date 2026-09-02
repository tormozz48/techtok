import type { Language } from './language';

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

export const TOPIC_LABELS: Record<Language, Record<Topic, string>> = {
  en: {
    ai: 'AI',
    dev: 'Dev',
    gadgets: 'Gadgets',
    startups: 'Startups',
    security: 'Security',
    science: 'Science',
    space: 'Space',
    bio: 'Bio',
  },
  ru: {
    ai: 'ИИ',
    dev: 'Разработка',
    gadgets: 'Гаджеты',
    startups: 'Стартапы',
    security: 'Безопасность',
    science: 'Наука',
    space: 'Космос',
    bio: 'Биология',
  },
  uk: {
    ai: 'ШІ',
    dev: 'Розробка',
    gadgets: 'Гаджети',
    startups: 'Стартапи',
    security: 'Безпека',
    science: 'Наука',
    space: 'Космос',
    bio: 'Біологія',
  },
  pl: {
    ai: 'AI',
    dev: 'Programowanie',
    gadgets: 'Gadżety',
    startups: 'Startupy',
    security: 'Bezpieczeństwo',
    science: 'Nauka',
    space: 'Kosmos',
    bio: 'Biologia',
  },
};

export function getTopicLabel(topic: Topic, lang: Language): string {
  return TOPIC_LABELS[lang][topic];
}
