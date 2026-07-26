import type { Language } from '@techtok/shared';

export interface ChromeStrings {
  feed: {
    error: string;
    retry: string;
    empty: string;
  };
  history: {
    title: string;
    error: string;
    empty: string;
  };
  saved: {
    title: string;
    error: string;
    empty: string;
  };
  settings: {
    title: string;
    hintAll: string;
    hintSome: (selected: number, total: number) => string;
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
    sourceCount: (count: number) => string;
  };
  reader: {
    error: string;
    readOriginal: string;
    showOriginal: string;
    showTranslated: string;
    loading: string;
  };
  stats: {
    title: string;
    error: string;
    empty: string;
    thisWeek: string;
    thisMonth: string;
    streak: string;
    topTopics: string;
    topSources: string;
  };
  time: {
    justNow: string;
    minutesAgo: (n: number) => string;
    hoursAgo: (n: number) => string;
    daysAgo: (n: number) => string;
    weeksAgo: (n: number) => string;
  };
  a11y: {
    bookmarkAdd: string;
    bookmarkRemove: string;
    share: string;
    openSaved: string;
    openHistory: string;
    openSettings: string;
    removeSaved: string;
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
      retry: 'Try again',
      empty: 'No stories yet — check back after the next ingest run.',
    },
    history: {
      title: 'History',
      error: 'Failed to load history.',
      empty: 'Nothing read yet — swipe through the feed first.',
    },
    saved: {
      title: 'Saved',
      error: 'Failed to load saved posts.',
      empty: 'Nothing saved yet — bookmark a card from the feed.',
    },
    settings: {
      title: 'Settings',
      hintAll: 'Showing all topics. Select any to narrow your feed.',
      hintSome: (selected, total) => `Showing ${selected} of ${total} topics.`,
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
      sourceCount: (count) => `Covered by ${count} sources`,
    },
    reader: {
      error: "Couldn't prepare this article.",
      readOriginal: 'Read original',
      showOriginal: 'Show original',
      showTranslated: 'Show translation',
      loading: 'Preparing article…',
    },
    stats: {
      title: 'Stats',
      error: 'Failed to load your reading stats.',
      empty: 'Nothing read yet — your stats will show up here.',
      thisWeek: 'This week',
      thisMonth: 'This month',
      streak: 'Day streak',
      topTopics: 'Top topics',
      topSources: 'Top sources',
    },
    time: {
      justNow: 'just now',
      minutesAgo: (n) => `${n}m ago`,
      hoursAgo: (n) => `${n}h ago`,
      daysAgo: (n) => `${n}d ago`,
      weeksAgo: (n) => `${n}w ago`,
    },
    a11y: {
      bookmarkAdd: 'Save',
      bookmarkRemove: 'Remove from saved',
      share: 'Share',
      openSaved: 'Open saved',
      openHistory: 'Open history',
      openSettings: 'Open settings',
      removeSaved: 'Remove from saved',
    },
  },
  ru: {
    feed: {
      error: 'Не удалось загрузить ленту.',
      retry: 'Повторить',
      empty: 'Пока нет новостей — загляните после следующего обновления.',
    },
    history: {
      title: 'История',
      error: 'Не удалось загрузить историю.',
      empty: 'Пока ничего не прочитано — сначала полистайте ленту.',
    },
    saved: {
      title: 'Сохранённое',
      error: 'Не удалось загрузить сохранённое.',
      empty: 'Пока ничего не сохранено — добавьте карточку из ленты.',
    },
    settings: {
      title: 'Настройки',
      hintAll: 'Показаны все темы. Выберите нужные, чтобы сузить ленту.',
      hintSome: (selected, total) => `Показано ${selected} из ${total} тем.`,
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
      sourceCount: (count) => `Освещается в ${count} источниках`,
    },
    reader: {
      error: 'Не удалось подготовить статью.',
      readOriginal: 'Читать оригинал',
      showOriginal: 'Показать оригинал',
      showTranslated: 'Показать перевод',
      loading: 'Готовим статью…',
    },
    stats: {
      title: 'Статистика',
      error: 'Не удалось загрузить статистику чтения.',
      empty: 'Пока ничего не прочитано — статистика появится здесь.',
      thisWeek: 'За неделю',
      thisMonth: 'За месяц',
      streak: 'Дней подряд',
      topTopics: 'Популярные темы',
      topSources: 'Популярные источники',
    },
    time: {
      justNow: 'только что',
      minutesAgo: (n) => `${n} мин. назад`,
      hoursAgo: (n) => `${n} ч. назад`,
      daysAgo: (n) => `${n} дн. назад`,
      weeksAgo: (n) => `${n} нед. назад`,
    },
    a11y: {
      bookmarkAdd: 'Сохранить',
      bookmarkRemove: 'Убрать из сохранённого',
      share: 'Поделиться',
      openSaved: 'Открыть сохранённое',
      openHistory: 'Открыть историю',
      openSettings: 'Открыть настройки',
      removeSaved: 'Убрать из сохранённого',
    },
  },
  uk: {
    feed: {
      error: 'Не вдалося завантажити стрічку.',
      retry: 'Повторити',
      empty: 'Поки що немає новин — зазирніть після наступного оновлення.',
    },
    history: {
      title: 'Історія',
      error: 'Не вдалося завантажити історію.',
      empty: 'Поки що нічого не прочитано — спершу погортайте стрічку.',
    },
    saved: {
      title: 'Збережене',
      error: 'Не вдалося завантажити збережене.',
      empty: 'Поки що нічого не збережено — додайте картку зі стрічки.',
    },
    settings: {
      title: 'Налаштування',
      hintAll: 'Показано всі теми. Оберіть потрібні, щоб звузити стрічку.',
      hintSome: (selected, total) => `Показано ${selected} з ${total} тем.`,
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
      sourceCount: (count) => `Висвітлюється у ${count} джерелах`,
    },
    reader: {
      error: 'Не вдалося підготувати статтю.',
      readOriginal: 'Читати оригінал',
      showOriginal: 'Показати оригінал',
      showTranslated: 'Показати переклад',
      loading: 'Готуємо статтю…',
    },
    stats: {
      title: 'Статистика',
      error: 'Не вдалося завантажити статистику читання.',
      empty: 'Поки що нічого не прочитано — статистика зʼявиться тут.',
      thisWeek: 'За тиждень',
      thisMonth: 'За місяць',
      streak: 'Днів поспіль',
      topTopics: 'Популярні теми',
      topSources: 'Популярні джерела',
    },
    time: {
      justNow: 'щойно',
      minutesAgo: (n) => `${n} хв тому`,
      hoursAgo: (n) => `${n} год тому`,
      daysAgo: (n) => `${n} дн тому`,
      weeksAgo: (n) => `${n} тиж тому`,
    },
    a11y: {
      bookmarkAdd: 'Зберегти',
      bookmarkRemove: 'Прибрати зі збереженого',
      share: 'Поділитися',
      openSaved: 'Відкрити збережене',
      openHistory: 'Відкрити історію',
      openSettings: 'Відкрити налаштування',
      removeSaved: 'Прибрати зі збереженого',
    },
  },
  pl: {
    feed: {
      error: 'Nie udało się wczytać kanału.',
      retry: 'Spróbuj ponownie',
      empty: 'Brak historii — zajrzyj ponownie po kolejnej aktualizacji.',
    },
    history: {
      title: 'Historia',
      error: 'Nie udało się wczytać historii.',
      empty: 'Nic jeszcze nie przeczytano — najpierw przewiń kanał.',
    },
    saved: {
      title: 'Zapisane',
      error: 'Nie udało się wczytać zapisanych wpisów.',
      empty: 'Nic jeszcze nie zapisano — dodaj kartę z kanału.',
    },
    settings: {
      title: 'Ustawienia',
      hintAll: 'Wyświetlane są wszystkie tematy. Wybierz, aby zawęzić kanał.',
      hintSome: (selected, total) => `Wyświetlono ${selected} z ${total} tematów.`,
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
      sourceCount: (count) => `Relacjonowane przez ${count} źródeł`,
    },
    reader: {
      error: 'Nie udało się przygotować artykułu.',
      readOriginal: 'Czytaj oryginał',
      showOriginal: 'Pokaż oryginał',
      showTranslated: 'Pokaż tłumaczenie',
      loading: 'Przygotowujemy artykuł…',
    },
    stats: {
      title: 'Statystyki',
      error: 'Nie udało się wczytać statystyk czytania.',
      empty: 'Nic jeszcze nie przeczytano — statystyki pojawią się tutaj.',
      thisWeek: 'W tym tygodniu',
      thisMonth: 'W tym miesiącu',
      streak: 'Dni z rzędu',
      topTopics: 'Popularne tematy',
      topSources: 'Popularne źródła',
    },
    time: {
      justNow: 'przed chwilą',
      minutesAgo: (n) => `${n} min temu`,
      hoursAgo: (n) => `${n} godz. temu`,
      daysAgo: (n) => `${n} dni temu`,
      weeksAgo: (n) => `${n} tyg. temu`,
    },
    a11y: {
      bookmarkAdd: 'Zapisz',
      bookmarkRemove: 'Usuń z zapisanych',
      share: 'Udostępnij',
      openSaved: 'Otwórz zapisane',
      openHistory: 'Otwórz historię',
      openSettings: 'Otwórz ustawienia',
      removeSaved: 'Usuń z zapisanych',
    },
  },
};
