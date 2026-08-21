import type { Language } from '@techtok/shared';

export interface SiteStrings {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    features: string;
    topics: string;
    sources: string;
    releases: string;
    download: string;
  };
  hero: {
    eyebrow: string;
    tagline: string;
    ctaDownload: string;
    ctaGithub: string;
  };
  mockup: {
    topic: string;
    headline: string;
    snippet: string;
    translatedBadge: string;
  };
  features: {
    title: string;
    items: { title: string; description: string }[];
  };
  topics: {
    title: string;
    subtitle: string;
  };
  sources: {
    title: string;
    subtitle: string;
  };
  releases: {
    title: string;
    subtitle: string;
    featuresLabel: string;
    fixesLabel: string;
    noChanges: string;
  };
  download: {
    title: string;
    subtitle: string;
    version: (version: string) => string;
    qrHint: string;
    ctaDownload: string;
    ctaReleases: string;
    installNote: string;
  };
  footer: {
    tagline: string;
    sourceCode: string;
    license: string;
    privacy: string;
    deleteAccount: string;
  };
}

export const SITE_COPY: Record<Language, SiteStrings> = {
  en: {
    meta: {
      title: 'TechTok — Tech & Science News, Swiped',
      description:
        'TechTok turns tech & science news into a TikTok-style swipeable feed — condensed by AI, translated into your language, no account needed.',
    },
    nav: {
      features: 'Features',
      topics: 'Topics',
      sources: 'Sources',
      releases: 'Releases',
      download: 'Download',
    },
    hero: {
      eyebrow: 'Tech & science news, swiped',
      tagline:
        'Articles condensed into short cards with AI, translated into your language — swipe through headlines, tap into a full article when one grabs you.',
      ctaDownload: 'Get the app',
      ctaGithub: 'View on GitHub',
    },
    mockup: {
      topic: 'AI',
      headline: 'New model can explain its own reasoning',
      snippet: 'Researchers say the technique cuts hallucinations by half in early tests.',
      translatedBadge: 'Translated',
    },
    features: {
      title: 'Why TechTok',
      items: [
        {
          title: "Swipe, don't scroll",
          description:
            'A TikTok-style feed for headlines — flick through stories instead of scrolling a list.',
        },
        {
          title: 'Condensed by AI',
          description:
            'Every article is boiled down to a short card by an LLM, so you get the gist in seconds.',
        },
        {
          title: 'Reads in your language',
          description:
            'Cards are translated into English, Russian, Ukrainian, or Polish automatically.',
        },
        {
          title: 'Full article, one tap',
          description: 'Want more? Open a clean compact reader without leaving the app.',
        },
        {
          title: 'Bookmarks & history',
          description: 'Save what matters and pick up your reading history later.',
        },
        {
          title: 'No account needed',
          description: 'Your reading history, bookmarks, and preferences just follow your device.',
        },
      ],
    },
    topics: {
      title: 'Topics',
      subtitle: 'Pick the ones you care about — or leave them all on.',
    },
    sources: {
      title: 'Sources',
      subtitle: 'Pulled in automatically from a curated set of feeds.',
    },
    releases: {
      title: "What's new",
      subtitle: 'The latest updates, straight from the changelog.',
      featuresLabel: 'Features',
      fixesLabel: 'Fixes',
      noChanges: 'No user-facing changes in this release.',
    },
    download: {
      title: 'Get the app',
      subtitle: 'Scan the QR code or tap the button to download the latest Android build.',
      version: (version) => `Version ${version}`,
      qrHint: "Scan with your phone's camera",
      ctaDownload: 'Download APK',
      ctaReleases: 'All builds',
      installNote:
        "Android will ask you to allow installs from this source the first time — that's expected for an app outside the Play Store.",
    },
    footer: {
      tagline: 'TechTok — tech & science news, swiped.',
      sourceCode: 'Source code',
      license: 'MIT licensed',
      privacy: 'Privacy',
      deleteAccount: 'Delete account',
    },
  },
  ru: {
    meta: {
      title: 'TechTok — новости технологий и науки одним движением',
      description:
        'TechTok превращает новости технологий и науки в вертикальную ленту в стиле TikTok — карточки сокращает ИИ, переводит на ваш язык, без регистрации.',
    },
    nav: {
      features: 'Возможности',
      topics: 'Темы',
      sources: 'Источники',
      releases: 'Релизы',
      download: 'Скачать',
    },
    hero: {
      eyebrow: 'Новости технологий и науки одним движением',
      tagline:
        'ИИ сокращает статьи до коротких карточек и переводит их на ваш язык — листайте заголовки и открывайте полную статью, если она зацепила.',
      ctaDownload: 'Скачать приложение',
      ctaGithub: 'Открыть на GitHub',
    },
    mockup: {
      topic: 'ИИ',
      headline: 'Новая модель объясняет собственные рассуждения',
      snippet: 'Исследователи говорят, что методика вдвое снижает число ошибок в ранних тестах.',
      translatedBadge: 'Перевод',
    },
    features: {
      title: 'Почему TechTok',
      items: [
        {
          title: 'Листайте, а не скрольте',
          description: 'Лента в стиле TikTok для заголовков — пролистывайте истории вместо списка.',
        },
        {
          title: 'Сокращено ИИ',
          description:
            'Каждая статья сжимается языковой моделью до короткой карточки — суть за секунды.',
        },
        {
          title: 'На вашем языке',
          description:
            'Карточки автоматически переводятся на английский, русский, украинский или польский.',
        },
        {
          title: 'Полная статья в один тап',
          description:
            'Хотите подробнее? Откройте статью в удобной читалке, не выходя из приложения.',
        },
        {
          title: 'Закладки и история',
          description: 'Сохраняйте важное и возвращайтесь к прочитанному позже.',
        },
        {
          title: 'Без регистрации',
          description: 'История чтения, закладки и настройки просто хранятся на вашем устройстве.',
        },
      ],
    },
    topics: {
      title: 'Темы',
      subtitle: 'Выберите интересные вам — или оставьте все включёнными.',
    },
    sources: {
      title: 'Источники',
      subtitle: 'Загружаются автоматически из подобранного набора RSS-лент.',
    },
    releases: {
      title: 'Что нового',
      subtitle: 'Последние обновления — прямо из списка изменений.',
      featuresLabel: 'Новое',
      fixesLabel: 'Исправления',
      noChanges: 'В этом релизе нет изменений, заметных пользователю.',
    },
    download: {
      title: 'Скачать приложение',
      subtitle:
        'Отсканируйте QR-код или нажмите кнопку, чтобы скачать последнюю версию для Android.',
      version: (version) => `Версия ${version}`,
      qrHint: 'Отсканируйте камерой телефона',
      ctaDownload: 'Скачать APK',
      ctaReleases: 'Все версии',
      installNote:
        'Android попросит разрешить установку из этого источника при первом запуске — это ожидаемо для приложения не из Play Store.',
    },
    footer: {
      tagline: 'TechTok — новости технологий и науки одним движением.',
      sourceCode: 'Исходный код',
      license: 'Лицензия MIT',
      privacy: 'Конфиденциальность',
      deleteAccount: 'Удаление аккаунта',
    },
  },
  uk: {
    meta: {
      title: 'TechTok — новини технологій і науки одним рухом',
      description:
        'TechTok перетворює новини технологій і науки на вертикальну стрічку у стилі TikTok — картки скорочує ШІ, перекладає на вашу мову, без реєстрації.',
    },
    nav: {
      features: 'Можливості',
      topics: 'Теми',
      sources: 'Джерела',
      releases: 'Релізи',
      download: 'Завантажити',
    },
    hero: {
      eyebrow: 'Новини технологій і науки одним рухом',
      tagline:
        'ШІ скорочує статті до коротких карток і перекладає їх на вашу мову — гортайте заголовки й відкривайте повну статтю, якщо вона зацікавила.',
      ctaDownload: 'Завантажити застосунок',
      ctaGithub: 'Відкрити на GitHub',
    },
    mockup: {
      topic: 'ШІ',
      headline: 'Нова модель пояснює власні міркування',
      snippet: 'Дослідники кажуть, що методика вдвічі знижує кількість помилок у ранніх тестах.',
      translatedBadge: 'Переклад',
    },
    features: {
      title: 'Чому TechTok',
      items: [
        {
          title: 'Гортайте, а не скролте',
          description:
            'Стрічка у стилі TikTok для заголовків — перегортайте історії замість списку.',
        },
        {
          title: 'Скорочено ШІ',
          description:
            'Кожна стаття стискається мовною моделлю до короткої картки — суть за секунди.',
        },
        {
          title: 'Вашою мовою',
          description:
            'Картки автоматично перекладаються англійською, російською, українською або польською.',
        },
        {
          title: 'Повна стаття в один дотик',
          description:
            'Хочете більше? Відкрийте статтю в зручній читанці, не виходячи із застосунку.',
        },
        {
          title: 'Закладки та історія',
          description: 'Зберігайте важливе і повертайтеся до прочитаного пізніше.',
        },
        {
          title: 'Без реєстрації',
          description:
            'Історія читання, закладки та налаштування просто зберігаються на вашому пристрої.',
        },
      ],
    },
    topics: {
      title: 'Теми',
      subtitle: 'Оберіть цікаві вам — або залиште всі увімкненими.',
    },
    sources: {
      title: 'Джерела',
      subtitle: 'Завантажуються автоматично з підібраного набору RSS-стрічок.',
    },
    releases: {
      title: 'Що нового',
      subtitle: 'Останні оновлення — прямо зі списку змін.',
      featuresLabel: 'Нове',
      fixesLabel: 'Виправлення',
      noChanges: 'У цьому релізі немає змін, помітних користувачу.',
    },
    download: {
      title: 'Завантажити застосунок',
      subtitle:
        'Відскануйте QR-код або натисніть кнопку, щоб завантажити останню версію для Android.',
      version: (version) => `Версія ${version}`,
      qrHint: 'Відскануйте камерою телефона',
      ctaDownload: 'Завантажити APK',
      ctaReleases: 'Усі версії',
      installNote:
        'Android попросить дозволити встановлення з цього джерела під час першого запуску — це очікувано для застосунку поза Play Store.',
    },
    footer: {
      tagline: 'TechTok — новини технологій і науки одним рухом.',
      sourceCode: 'Початковий код',
      license: 'Ліцензія MIT',
      privacy: 'Конфіденційність',
      deleteAccount: 'Видалення облікового запису',
    },
  },
  pl: {
    meta: {
      title: 'TechTok — wiadomości technologiczne i naukowe w jednym geście',
      description:
        'TechTok zamienia wiadomości technologiczne i naukowe w przewijany kanał w stylu TikToka — karty skraca AI, tłumaczy na Twój język, bez konta.',
    },
    nav: {
      features: 'Funkcje',
      topics: 'Tematy',
      sources: 'Źródła',
      releases: 'Wydania',
      download: 'Pobierz',
    },
    hero: {
      eyebrow: 'Wiadomości technologiczne i naukowe w jednym geście',
      tagline:
        'AI skraca artykuły do krótkich kart i tłumaczy je na Twój język — przewijaj nagłówki i otwieraj cały artykuł, gdy któryś przyciągnie uwagę.',
      ctaDownload: 'Pobierz aplikację',
      ctaGithub: 'Zobacz na GitHub',
    },
    mockup: {
      topic: 'AI',
      headline: 'Nowy model wyjaśnia własne rozumowanie',
      snippet:
        'Badacze twierdzą, że technika ogranicza liczbę błędów o połowę w pierwszych testach.',
      translatedBadge: 'Tłumaczenie',
    },
    features: {
      title: 'Dlaczego TechTok',
      items: [
        {
          title: 'Przewijaj, nie scrolluj',
          description: 'Kanał w stylu TikToka dla nagłówków — przewijaj historie zamiast listy.',
        },
        {
          title: 'Skrócone przez AI',
          description:
            'Każdy artykuł jest skracany przez model językowy do krótkiej karty — sens w kilka sekund.',
        },
        {
          title: 'Czytaj w swoim języku',
          description:
            'Karty są automatycznie tłumaczone na angielski, rosyjski, ukraiński lub polski.',
        },
        {
          title: 'Cały artykuł jednym dotknięciem',
          description: 'Chcesz więcej? Otwórz artykuł w czytniku bez wychodzenia z aplikacji.',
        },
        {
          title: 'Zakładki i historia',
          description: 'Zapisuj to, co ważne, i wracaj do przeczytanego później.',
        },
        {
          title: 'Bez konta',
          description:
            'Historia czytania, zakładki i preferencje zostają po prostu na Twoim urządzeniu.',
        },
      ],
    },
    topics: {
      title: 'Tematy',
      subtitle: 'Wybierz te, które Cię interesują — albo zostaw wszystkie włączone.',
    },
    sources: {
      title: 'Źródła',
      subtitle: 'Pobierane automatycznie z wyselekcjonowanego zestawu kanałów RSS.',
    },
    releases: {
      title: 'Co nowego',
      subtitle: 'Najnowsze aktualizacje — prosto z listy zmian.',
      featuresLabel: 'Nowości',
      fixesLabel: 'Poprawki',
      noChanges: 'Brak zmian widocznych dla użytkownika w tym wydaniu.',
    },
    download: {
      title: 'Pobierz aplikację',
      subtitle: 'Zeskanuj kod QR albo kliknij przycisk, aby pobrać najnowszą wersję na Androida.',
      version: (version) => `Wersja ${version}`,
      qrHint: 'Zeskanuj aparatem telefonu',
      ctaDownload: 'Pobierz APK',
      ctaReleases: 'Wszystkie wersje',
      installNote:
        'Android przy pierwszym razie poprosi o zgodę na instalację z tego źródła — to normalne dla aplikacji spoza Play Store.',
    },
    footer: {
      tagline: 'TechTok — wiadomości technologiczne i naukowe w jednym geście.',
      sourceCode: 'Kod źródłowy',
      license: 'Licencja MIT',
      privacy: 'Prywatność',
      deleteAccount: 'Usuwanie konta',
    },
  },
};
