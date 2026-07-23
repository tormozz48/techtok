import type { Language } from '@techtok/shared';

export interface ChromeStrings {
  feed: {
    error: string;
    empty: string;
  };
  history: {
    error: string;
    empty: string;
  };
  saved: {
    error: string;
    empty: string;
  };
  settings: {
    hintAll: string;
    hintSome: (selected: number, total: number) => string;
    pushEnable: string;
    pushEnabled: string;
    feedback: string;
    languageSectionTitle: string;
  };
  onboarding: {
    title: string;
    languageStepTitle: string;
    hintAll: string;
    hintSome: (selected: number, total: number) => string;
    cta: string;
  };
  card: {
    translatedBadge: string;
  };
}

// Hand-written chrome copy (D20) — no i18n framework dependency. Keep every
// language's key set identical; `useStrings` indexes this table directly by
// the current language with no runtime fallback, so a missing key would be a
// type error, not a silent blank.
export const STRINGS: Record<Language, ChromeStrings> = {
  en: {
    feed: {
      error: 'Failed to load the feed.',
      empty: 'No stories yet — check back after the next ingest run.',
    },
    history: {
      error: 'Failed to load history.',
      empty: 'Nothing read yet — swipe through the feed first.',
    },
    saved: {
      error: 'Failed to load saved posts.',
      empty: 'Nothing saved yet — bookmark a card from the feed.',
    },
    settings: {
      hintAll: 'Showing all topics. Select any to narrow your feed.',
      hintSome: (selected, total) => `Showing ${selected} of ${total} topics.`,
      pushEnable: 'Enable daily digest notifications',
      pushEnabled: 'Daily digest notifications on',
      feedback: 'Send feedback',
      languageSectionTitle: 'Language',
    },
    onboarding: {
      title: 'Welcome to TechTok',
      languageStepTitle: 'Choose your language',
      hintAll: 'Pick the topics you care about, or leave everything on to see it all.',
      hintSome: (selected, total) => `Showing ${selected} of ${total} topics.`,
      cta: 'Get started',
    },
    card: {
      translatedBadge: 'Translated',
    },
  },
  ru: {
    feed: {
      error: 'Не удалось загрузить ленту.',
      empty: 'Пока нет новостей — загляните после следующего обновления.',
    },
    history: {
      error: 'Не удалось загрузить историю.',
      empty: 'Пока ничего не прочитано — сначала полистайте ленту.',
    },
    saved: {
      error: 'Не удалось загрузить сохранённое.',
      empty: 'Пока ничего не сохранено — добавьте карточку из ленты.',
    },
    settings: {
      hintAll: 'Показаны все темы. Выберите нужные, чтобы сузить ленту.',
      hintSome: (selected, total) => `Показано ${selected} из ${total} тем.`,
      pushEnable: 'Включить ежедневные уведомления',
      pushEnabled: 'Ежедневные уведомления включены',
      feedback: 'Отправить отзыв',
      languageSectionTitle: 'Язык',
    },
    onboarding: {
      title: 'Добро пожаловать в TechTok',
      languageStepTitle: 'Выберите язык',
      hintAll: 'Выберите интересные вам темы или оставьте всё включённым.',
      hintSome: (selected, total) => `Показано ${selected} из ${total} тем.`,
      cta: 'Начать',
    },
    card: {
      translatedBadge: 'Перевод',
    },
  },
  uk: {
    feed: {
      error: 'Не вдалося завантажити стрічку.',
      empty: 'Поки що немає новин — зазирніть після наступного оновлення.',
    },
    history: {
      error: 'Не вдалося завантажити історію.',
      empty: 'Поки що нічого не прочитано — спершу погортайте стрічку.',
    },
    saved: {
      error: 'Не вдалося завантажити збережене.',
      empty: 'Поки що нічого не збережено — додайте картку зі стрічки.',
    },
    settings: {
      hintAll: 'Показано всі теми. Оберіть потрібні, щоб звузити стрічку.',
      hintSome: (selected, total) => `Показано ${selected} з ${total} тем.`,
      pushEnable: 'Увімкнути щоденні сповіщення',
      pushEnabled: 'Щоденні сповіщення увімкнено',
      feedback: 'Надіслати відгук',
      languageSectionTitle: 'Мова',
    },
    onboarding: {
      title: 'Ласкаво просимо до TechTok',
      languageStepTitle: 'Оберіть мову',
      hintAll: 'Оберіть теми, які вам цікаві, або залиште все увімкненим.',
      hintSome: (selected, total) => `Показано ${selected} з ${total} тем.`,
      cta: 'Почати',
    },
    card: {
      translatedBadge: 'Переклад',
    },
  },
  pl: {
    feed: {
      error: 'Nie udało się wczytać kanału.',
      empty: 'Brak historii — zajrzyj ponownie po kolejnej aktualizacji.',
    },
    history: {
      error: 'Nie udało się wczytać historii.',
      empty: 'Nic jeszcze nie przeczytano — najpierw przewiń kanał.',
    },
    saved: {
      error: 'Nie udało się wczytać zapisanych wpisów.',
      empty: 'Nic jeszcze nie zapisano — dodaj kartę z kanału.',
    },
    settings: {
      hintAll: 'Wyświetlane są wszystkie tematy. Wybierz, aby zawęzić kanał.',
      hintSome: (selected, total) => `Wyświetlono ${selected} z ${total} tematów.`,
      pushEnable: 'Włącz codzienne powiadomienia',
      pushEnabled: 'Codzienne powiadomienia włączone',
      feedback: 'Wyślij opinię',
      languageSectionTitle: 'Język',
    },
    onboarding: {
      title: 'Witaj w TechTok',
      languageStepTitle: 'Wybierz język',
      hintAll: 'Wybierz interesujące Cię tematy albo zostaw wszystkie włączone.',
      hintSome: (selected, total) => `Wyświetlono ${selected} z ${total} tematów.`,
      cta: 'Zaczynajmy',
    },
    card: {
      translatedBadge: 'Tłumaczenie',
    },
  },
};
