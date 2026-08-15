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
    searchPlaceholder: string;
    noResults: string;
  };
  saved: {
    title: string;
    error: string;
    empty: string;
    searchPlaceholder: string;
    noResults: string;
  };
  settings: {
    title: string;
    hintAll: string;
    hintSome: (selected: number, total: number) => string;
    languageSectionTitle: string;
    themeSectionTitle: string;
    themeSystem: string;
    themeLight: string;
    themeDark: string;
    sourcesSectionTitle: string;
    sourcesHint: string;
  };
  onboarding: {
    title: string;
    languageStepTitle: string;
    hintAll: string;
    hintSome: (selected: number, total: number) => string;
    cta: string;
  };
  auth: {
    title: string;
    subtitle: string;
    signInCta: string;
    signingIn: string;
    error: string;
  };
  account: {
    title: string;
    signedInAs: (email: string) => string;
    signOut: string;
    deleteAccount: string;
    deleteAccountConfirmTitle: string;
    deleteAccountConfirmMessage: string;
    deleteAccountConfirmCta: string;
    deleteAccountError: string;
    cancel: string;
  };
  paywall: {
    title: string;
    subtitle: string;
    freePlanTitle: string;
    freePlanFeatureCardReads: (limit: number) => string;
    freePlanFeatureReaderOpens: (limit: number) => string;
    plusPlanTitle: string;
    plusPlanPriceMonthly: string;
    plusPlanPriceYearly: string;
    plusPlanFeatureUnlimited: string;
    comingSoonCta: string;
    quotaExhaustedTitle: string;
    quotaExhaustedMessage: (resetTime: string) => string;
  };
  quota: {
    planFree: string;
    planPlus: string;
    cardReadsLabel: string;
    readerOpensLabel: string;
    remaining: (used: number, limit: number) => string;
    unlimited: string;
    upgradeCta: string;
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
  speech: {
    listen: string;
    stopListening: string;
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
  crash: {
    title: string;
    message: string;
    retry: string;
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
      searchPlaceholder: 'Search history',
      noResults: 'No matches in your history.',
    },
    saved: {
      title: 'Saved',
      error: 'Failed to load saved posts.',
      empty: 'Nothing saved yet — bookmark a card from the feed.',
      searchPlaceholder: 'Search saved',
      noResults: 'No matches in your saved posts.',
    },
    settings: {
      title: 'Settings',
      hintAll: 'Showing all topics. Select any to narrow your feed.',
      hintSome: (selected, total) => `Showing ${selected} of ${total} topics.`,
      languageSectionTitle: 'Language',
      themeSectionTitle: 'Appearance',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
      sourcesSectionTitle: 'Sources',
      sourcesHint: 'Tap a source to mute it — muted sources are hidden from your feed.',
    },
    onboarding: {
      title: 'Welcome to TechTok',
      languageStepTitle: 'Choose your language',
      hintAll: 'Pick the topics you care about, or leave everything on to see it all.',
      hintSome: (selected, total) => `Showing ${selected} of ${total} topics.`,
      cta: 'Get started',
    },
    auth: {
      title: 'Welcome to TechTok',
      subtitle: 'Sign in with Google to start swiping.',
      signInCta: 'Sign in with Google',
      signingIn: 'Signing in…',
      error: 'Sign-in failed. Please try again.',
    },
    account: {
      title: 'Account',
      signedInAs: (email) => `Signed in as ${email}`,
      signOut: 'Sign out',
      deleteAccount: 'Delete account',
      deleteAccountConfirmTitle: 'Delete your account?',
      deleteAccountConfirmMessage:
        'This permanently deletes your reading history, bookmarks, and preferences. This cannot be undone.',
      deleteAccountConfirmCta: 'Delete',
      deleteAccountError: 'Failed to delete your account. Please try again.',
      cancel: 'Cancel',
    },
    paywall: {
      title: 'Upgrade to Plus',
      subtitle: 'Unlimited reading, no daily limits.',
      freePlanTitle: 'Free',
      freePlanFeatureCardReads: (limit) => `${limit} cards a day`,
      freePlanFeatureReaderOpens: (limit) => `${limit} articles a day`,
      plusPlanTitle: 'Plus',
      plusPlanPriceMonthly: '€2.99/mo',
      plusPlanPriceYearly: '€24.99/yr',
      plusPlanFeatureUnlimited: 'Unlimited cards and articles',
      comingSoonCta: 'Coming soon',
      quotaExhaustedTitle: "You've hit today's limit",
      quotaExhaustedMessage: (resetTime) => `Resets at ${resetTime}`,
    },
    quota: {
      planFree: 'Free plan',
      planPlus: 'Plus',
      cardReadsLabel: 'Cards today',
      readerOpensLabel: 'Articles today',
      remaining: (used, limit) => `${used} / ${limit}`,
      unlimited: 'Unlimited',
      upgradeCta: 'Upgrade',
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
    speech: {
      listen: 'Listen',
      stopListening: 'Stop listening',
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
    crash: {
      title: 'Something went wrong',
      message: 'The app hit an unexpected error. Restarting the screen should fix it.',
      retry: 'Try again',
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
      searchPlaceholder: 'Поиск по истории',
      noResults: 'Совпадений в истории не найдено.',
    },
    saved: {
      title: 'Сохранённое',
      error: 'Не удалось загрузить сохранённое.',
      empty: 'Пока ничего не сохранено — добавьте карточку из ленты.',
      searchPlaceholder: 'Поиск по сохранённому',
      noResults: 'Совпадений в сохранённом не найдено.',
    },
    settings: {
      title: 'Настройки',
      hintAll: 'Показаны все темы. Выберите нужные, чтобы сузить ленту.',
      hintSome: (selected, total) => `Показано ${selected} из ${total} тем.`,
      languageSectionTitle: 'Язык',
      themeSectionTitle: 'Оформление',
      themeSystem: 'Как в системе',
      themeLight: 'Светлая',
      themeDark: 'Тёмная',
      sourcesSectionTitle: 'Источники',
      sourcesHint: 'Нажмите на источник, чтобы скрыть его из ленты.',
    },
    onboarding: {
      title: 'Добро пожаловать в TechTok',
      languageStepTitle: 'Выберите язык',
      hintAll: 'Выберите интересные вам темы или оставьте всё включённым.',
      hintSome: (selected, total) => `Показано ${selected} из ${total} тем.`,
      cta: 'Начать',
    },
    auth: {
      title: 'Добро пожаловать в TechTok',
      subtitle: 'Войдите через Google, чтобы начать.',
      signInCta: 'Войти через Google',
      signingIn: 'Выполняется вход…',
      error: 'Не удалось войти. Попробуйте снова.',
    },
    account: {
      title: 'Аккаунт',
      signedInAs: (email) => `Вы вошли как ${email}`,
      signOut: 'Выйти',
      deleteAccount: 'Удалить аккаунт',
      deleteAccountConfirmTitle: 'Удалить аккаунт?',
      deleteAccountConfirmMessage:
        'Это навсегда удалит вашу историю чтения, закладки и настройки. Отменить это действие нельзя.',
      deleteAccountConfirmCta: 'Удалить',
      deleteAccountError: 'Не удалось удалить аккаунт. Попробуйте снова.',
      cancel: 'Отмена',
    },
    paywall: {
      title: 'Перейти на Plus',
      subtitle: 'Неограниченное чтение без дневных лимитов.',
      freePlanTitle: 'Бесплатный',
      freePlanFeatureCardReads: (limit) => `${limit} карточек в день`,
      freePlanFeatureReaderOpens: (limit) => `${limit} статей в день`,
      plusPlanTitle: 'Plus',
      plusPlanPriceMonthly: '€2.99/мес',
      plusPlanPriceYearly: '€24.99/год',
      plusPlanFeatureUnlimited: 'Неограниченно карточек и статей',
      comingSoonCta: 'Скоро',
      quotaExhaustedTitle: 'Вы достигли дневного лимита',
      quotaExhaustedMessage: (resetTime) => `Сброс в ${resetTime}`,
    },
    quota: {
      planFree: 'Бесплатный план',
      planPlus: 'Plus',
      cardReadsLabel: 'Карточек сегодня',
      readerOpensLabel: 'Статей сегодня',
      remaining: (used, limit) => `${used} / ${limit}`,
      unlimited: 'Без ограничений',
      upgradeCta: 'Улучшить',
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
    speech: {
      listen: 'Слушать',
      stopListening: 'Остановить',
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
    crash: {
      title: 'Что-то пошло не так',
      message: 'Приложение столкнулось с неожиданной ошибкой. Перезапуск экрана должен помочь.',
      retry: 'Повторить',
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
      searchPlaceholder: 'Пошук в історії',
      noResults: 'Збігів в історії не знайдено.',
    },
    saved: {
      title: 'Збережене',
      error: 'Не вдалося завантажити збережене.',
      empty: 'Поки що нічого не збережено — додайте картку зі стрічки.',
      searchPlaceholder: 'Пошук у збереженому',
      noResults: 'Збігів у збереженому не знайдено.',
    },
    settings: {
      title: 'Налаштування',
      hintAll: 'Показано всі теми. Оберіть потрібні, щоб звузити стрічку.',
      hintSome: (selected, total) => `Показано ${selected} з ${total} тем.`,
      languageSectionTitle: 'Мова',
      themeSectionTitle: 'Оформлення',
      themeSystem: 'Як у системі',
      themeLight: 'Світла',
      themeDark: 'Темна',
      sourcesSectionTitle: 'Джерела',
      sourcesHint: 'Торкніться джерела, щоб приховати його зі стрічки.',
    },
    onboarding: {
      title: 'Ласкаво просимо до TechTok',
      languageStepTitle: 'Оберіть мову',
      hintAll: 'Оберіть теми, які вам цікаві, або залиште все увімкненим.',
      hintSome: (selected, total) => `Показано ${selected} з ${total} тем.`,
      cta: 'Почати',
    },
    auth: {
      title: 'Ласкаво просимо до TechTok',
      subtitle: 'Увійдіть через Google, щоб почати.',
      signInCta: 'Увійти через Google',
      signingIn: 'Виконується вхід…',
      error: 'Не вдалося увійти. Спробуйте ще раз.',
    },
    account: {
      title: 'Обліковий запис',
      signedInAs: (email) => `Ви увійшли як ${email}`,
      signOut: 'Вийти',
      deleteAccount: 'Видалити обліковий запис',
      deleteAccountConfirmTitle: 'Видалити обліковий запис?',
      deleteAccountConfirmMessage:
        'Це назавжди видалить вашу історію читання, закладки та налаштування. Цю дію не можна скасувати.',
      deleteAccountConfirmCta: 'Видалити',
      deleteAccountError: 'Не вдалося видалити обліковий запис. Спробуйте ще раз.',
      cancel: 'Скасувати',
    },
    paywall: {
      title: 'Перейти на Plus',
      subtitle: 'Необмежене читання без денних лімітів.',
      freePlanTitle: 'Безкоштовний',
      freePlanFeatureCardReads: (limit) => `${limit} карток на день`,
      freePlanFeatureReaderOpens: (limit) => `${limit} статей на день`,
      plusPlanTitle: 'Plus',
      plusPlanPriceMonthly: '€2.99/міс',
      plusPlanPriceYearly: '€24.99/рік',
      plusPlanFeatureUnlimited: 'Необмежено карток і статей',
      comingSoonCta: 'Скоро',
      quotaExhaustedTitle: 'Ви досягли денного ліміту',
      quotaExhaustedMessage: (resetTime) => `Скидання о ${resetTime}`,
    },
    quota: {
      planFree: 'Безкоштовний план',
      planPlus: 'Plus',
      cardReadsLabel: 'Карток сьогодні',
      readerOpensLabel: 'Статей сьогодні',
      remaining: (used, limit) => `${used} / ${limit}`,
      unlimited: 'Без обмежень',
      upgradeCta: 'Покращити',
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
    speech: {
      listen: 'Слухати',
      stopListening: 'Зупинити',
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
    crash: {
      title: 'Щось пішло не так',
      message: 'Додаток зіткнувся з неочікуваною помилкою. Перезапуск екрана має допомогти.',
      retry: 'Спробувати ще раз',
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
      searchPlaceholder: 'Szukaj w historii',
      noResults: 'Brak wyników w historii.',
    },
    saved: {
      title: 'Zapisane',
      error: 'Nie udało się wczytać zapisanych wpisów.',
      empty: 'Nic jeszcze nie zapisano — dodaj kartę z kanału.',
      searchPlaceholder: 'Szukaj w zapisanych',
      noResults: 'Brak wyników w zapisanych.',
    },
    settings: {
      title: 'Ustawienia',
      hintAll: 'Wyświetlane są wszystkie tematy. Wybierz, aby zawęzić kanał.',
      hintSome: (selected, total) => `Wyświetlono ${selected} z ${total} tematów.`,
      languageSectionTitle: 'Język',
      themeSectionTitle: 'Wygląd',
      themeSystem: 'Systemowy',
      themeLight: 'Jasny',
      themeDark: 'Ciemny',
      sourcesSectionTitle: 'Źródła',
      sourcesHint: 'Dotknij źródła, aby ukryć je z kanału.',
    },
    onboarding: {
      title: 'Witaj w TechTok',
      languageStepTitle: 'Wybierz język',
      hintAll: 'Wybierz interesujące Cię tematy albo zostaw wszystkie włączone.',
      hintSome: (selected, total) => `Wyświetlono ${selected} z ${total} tematów.`,
      cta: 'Zaczynajmy',
    },
    auth: {
      title: 'Witamy w TechTok',
      subtitle: 'Zaloguj się przez Google, aby zacząć.',
      signInCta: 'Zaloguj się przez Google',
      signingIn: 'Logowanie…',
      error: 'Logowanie nie powiodło się. Spróbuj ponownie.',
    },
    account: {
      title: 'Konto',
      signedInAs: (email) => `Zalogowano jako ${email}`,
      signOut: 'Wyloguj się',
      deleteAccount: 'Usuń konto',
      deleteAccountConfirmTitle: 'Usunąć konto?',
      deleteAccountConfirmMessage:
        'To trwale usunie Twoją historię czytania, zapisane artykuły i ustawienia. Tej operacji nie można cofnąć.',
      deleteAccountConfirmCta: 'Usuń',
      deleteAccountError: 'Nie udało się usunąć konta. Spróbuj ponownie.',
      cancel: 'Anuluj',
    },
    paywall: {
      title: 'Przejdź na Plus',
      subtitle: 'Nieograniczone czytanie, bez dziennych limitów.',
      freePlanTitle: 'Bezpłatny',
      freePlanFeatureCardReads: (limit) => `${limit} kart dziennie`,
      freePlanFeatureReaderOpens: (limit) => `${limit} artykułów dziennie`,
      plusPlanTitle: 'Plus',
      plusPlanPriceMonthly: '€2.99/mies.',
      plusPlanPriceYearly: '€24.99/rok',
      plusPlanFeatureUnlimited: 'Nieograniczona liczba kart i artykułów',
      comingSoonCta: 'Wkrótce',
      quotaExhaustedTitle: 'Osiągnięto dzisiejszy limit',
      quotaExhaustedMessage: (resetTime) => `Odnowienie o ${resetTime}`,
    },
    quota: {
      planFree: 'Plan bezpłatny',
      planPlus: 'Plus',
      cardReadsLabel: 'Kart dzisiaj',
      readerOpensLabel: 'Artykułów dzisiaj',
      remaining: (used, limit) => `${used} / ${limit}`,
      unlimited: 'Bez limitu',
      upgradeCta: 'Ulepsz',
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
    speech: {
      listen: 'Odsłuchaj',
      stopListening: 'Zatrzymaj',
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
    crash: {
      title: 'Coś poszło nie tak',
      message: 'Aplikacja napotkała nieoczekiwany błąd. Ponowne uruchomienie ekranu powinno pomóc.',
      retry: 'Spróbuj ponownie',
    },
  },
};
