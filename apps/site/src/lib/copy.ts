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
    tester: string;
  };
  doc: {
    back: string;
    updated: (date: string) => string;
  };
  tester: {
    metaTitle: string;
    metaDescription: string;
    title: string;
    intro: string;
    whyTitle: string;
    whyBody: string;
    askTitle: string;
    ask: string[];
    stepsTitle: string;
    steps: { title: string; body: string }[];
    qrHint: string;
    ctaEmail: string;
    ctaOptIn: string;
    mailSubject: string;
    mailBody: string;
    perksTitle: string;
    perksBody: string;
    feedbackTitle: string;
    feedbackBody: string;
    privacyTitle: string;
    privacyBody: string;
    privacyLink: string;
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
      title: 'Join the beta',
      subtitle: 'Scan the QR code or tap the button to opt in as a tester on Google Play.',
      version: (version) => `Version ${version}`,
      qrHint: "Scan with your phone's camera",
      ctaDownload: 'Become a tester',
      ctaReleases: 'All builds',
      installNote:
        "You'll accept the invitation and install TechTok through the Play Store — no sideloading needed.",
    },
    footer: {
      tagline: 'TechTok — tech & science news, swiped.',
      sourceCode: 'Source code',
      license: 'MIT licensed',
      privacy: 'Privacy',
      deleteAccount: 'Delete account',
      tester: 'Become a tester',
    },
    doc: {
      back: '← Back to TechTok',
      updated: (date) => `Last updated ${date}`,
    },
    tester: {
      metaTitle: 'Become a TechTok tester',
      metaDescription:
        'TechTok needs a dozen testers for two weeks before it can launch on Google Play. Here is what it involves and how to join.',
      title: 'Become a TechTok tester',
      intro:
        'TechTok is finished and working. Before Google will let it onto the Play Store, it has to spend two weeks in a closed test with a dozen real people. That is what this page is asking you for — about a minute a day, for fourteen days.',
      whyTitle: 'Why this is needed',
      whyBody:
        'Google requires every new app from a personal developer account to run a closed test with at least 12 testers who stay opted in for 14 days in a row. No test, no publication. The rule exists to keep junk off the Play Store, and there is no way around it.',
      askTitle: 'What it takes',
      ask: [
        'An Android phone with the Play Store on it, and the Google account that phone is signed in with.',
        'Installing TechTok and staying in the test for the full 14 days.',
        'Opening the app now and then. A minute a day is plenty — it is a swipe feed, so that is a handful of cards.',
        'Telling me what annoys you. That part is optional, but it is the reason the test is worth running.',
      ],
      stepsTitle: 'How to join',
      steps: [
        {
          title: 'Send me your Google address',
          body: 'Google only lets invited addresses into a closed test, so your address has to go on the list before anything else works. Use the one your Android phone is signed in with.',
        },
        {
          title: 'Wait for a short reply',
          body: 'You will hear back once you are on the list — usually the same day. Only then does the invitation link below do anything.',
        },
        {
          title: 'Accept the invitation',
          body: 'Open the testing link on your phone, or scan the QR code with its camera, and tap the button that makes you a tester.',
        },
        {
          title: 'Install from Google Play',
          body: 'An ordinary Play Store page appears right after you accept. Install it the usual way — nothing to sideload, and updates arrive on their own.',
        },
        {
          title: 'Use it for two weeks',
          body: 'Open the app every so often over the next 14 days, and stay in the test the whole time. Leaving early takes the count below 12 and restarts the clock for everybody, so if you need to drop out, say so first.',
        },
      ],
      qrHint: "Scan with your phone's camera",
      ctaEmail: 'Email me your address',
      ctaOptIn: 'Open the invitation',
      mailSubject: 'TechTok tester',
      mailBody: 'Hi! I would like to join the TechTok closed test. My Google account address is: ',
      perksTitle: 'What you get',
      perksBody:
        'Testers keep TechTok Plus for free, for as long as they want it — the paid tier, at no cost, whatever it ends up costing everyone else.',
      feedbackTitle: 'Feedback',
      feedbackBody:
        'A bad translation, a card that makes no sense, a crash, a button in the wrong place, a source you wish were there — send any of it to the same address. At the end of the test Google asks what the testers said and what changed because of it, so your notes genuinely end up in that answer.',
      privacyTitle: 'What happens to your address',
      privacyBody:
        'It goes onto the tester list in Google Play Console, and nowhere else. No mailing list, nothing passed to anyone. If you then sign in to the app, TechTok stores your Google account identifier, your email and your display name, and nothing further about you.',
      privacyLink: 'Read the privacy policy',
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
      title: 'Присоединиться к тестированию',
      subtitle: 'Отсканируйте QR-код или нажмите кнопку, чтобы стать тестировщиком в Google Play.',
      version: (version) => `Версия ${version}`,
      qrHint: 'Отсканируйте камерой телефона',
      ctaDownload: 'Стать тестировщиком',
      ctaReleases: 'Все версии',
      installNote:
        'Вы примете приглашение и установите TechTok через Play Store — без установки APK вручную.',
    },
    footer: {
      tagline: 'TechTok — новости технологий и науки одним движением.',
      sourceCode: 'Исходный код',
      license: 'Лицензия MIT',
      privacy: 'Конфиденциальность',
      deleteAccount: 'Удаление аккаунта',
      tester: 'Стать тестировщиком',
    },
    doc: {
      back: '← Назад к TechTok',
      updated: (date) => `Обновлено ${date}`,
    },
    tester: {
      metaTitle: 'Стать тестировщиком TechTok',
      metaDescription:
        'Чтобы выйти в Google Play, TechTok нужны две недели закрытого тестирования и дюжина тестировщиков. Что для этого нужно и как присоединиться.',
      title: 'Стать тестировщиком TechTok',
      intro:
        'TechTok готов и работает. Но прежде чем Google пустит его в Play Store, приложение должно две недели пройти закрытое тестирование с дюжиной живых людей. Об этом и просит эта страница — примерно минута в день в течение четырнадцати дней.',
      whyTitle: 'Зачем это нужно',
      whyBody:
        'Google требует, чтобы каждое новое приложение от личного аккаунта разработчика прошло закрытое тестирование: минимум 12 тестировщиков, непрерывно участвующих 14 дней подряд. Нет теста — нет публикации. Правило придумано, чтобы в Play Store не попадал мусор, и обойти его нельзя.',
      askTitle: 'Что потребуется от вас',
      ask: [
        'Телефон на Android с Play Store и аккаунт Google, под которым вы в него вошли.',
        'Установить TechTok и остаться в тесте все 14 дней.',
        'Время от времени открывать приложение. Минуты в день достаточно — это лента со свайпами, то есть несколько карточек.',
        'Рассказать, что раздражает. Это необязательно, но ровно ради этого тест и имеет смысл.',
      ],
      stepsTitle: 'Как присоединиться',
      steps: [
        {
          title: 'Пришлите адрес своего аккаунта Google',
          body: 'В закрытый тест Google пускает только приглашённые адреса, поэтому сначала ваш адрес должен попасть в список. Нужен тот, под которым вы вошли на своём телефоне.',
        },
        {
          title: 'Дождитесь короткого ответа',
          body: 'Я напишу, когда добавлю вас в список, — обычно в тот же день. Только после этого ссылка ниже начнёт работать.',
        },
        {
          title: 'Примите приглашение',
          body: 'Откройте ссылку на телефоне или наведите на QR-код камеру и нажмите кнопку, которая делает вас тестировщиком.',
        },
        {
          title: 'Установите из Google Play',
          body: 'Сразу после этого откроется обычная страница в Play Store. Ставьте как всегда — никаких APK вручную, обновления придут сами.',
        },
        {
          title: 'Пользуйтесь две недели',
          body: 'Заглядывайте в приложение время от времени в течение 14 дней и не выходите из теста. Досрочный выход уводит счёт ниже 12 и обнуляет отсчёт для всех, так что если нужно выйти — просто скажите заранее.',
        },
      ],
      qrHint: 'Наведите камеру телефона',
      ctaEmail: 'Отправить свой адрес',
      ctaOptIn: 'Открыть приглашение',
      mailSubject: 'Тестирование TechTok',
      mailBody:
        'Привет! Хочу участвовать в закрытом тестировании TechTok. Адрес моего аккаунта Google: ',
      perksTitle: 'Что вы получите',
      perksBody:
        'Тестировщики бесплатно оставляют себе TechTok Plus — платный тариф, без оплаты, столько, сколько захотят, сколько бы он потом ни стоил остальным.',
      feedbackTitle: 'Обратная связь',
      feedbackBody:
        'Кривой перевод, бессмысленная карточка, вылет, кнопка не на месте, не хватает источника — пишите на тот же адрес. В конце теста Google спрашивает, что сказали тестировщики и что изменилось благодаря этому, так что ваши замечания реально попадут в этот ответ.',
      privacyTitle: 'Что будет с вашим адресом',
      privacyBody:
        'Он попадёт в список тестировщиков в Google Play Console и больше никуда. Никаких рассылок, никому не передаётся. Если вы потом войдёте в приложение, TechTok сохранит идентификатор вашего аккаунта Google, адрес почты и отображаемое имя — и больше ничего о вас.',
      privacyLink: 'Политика конфиденциальности',
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
      title: 'Приєднатися до тестування',
      subtitle: 'Відскануйте QR-код або натисніть кнопку, щоб стати тестувальником у Google Play.',
      version: (version) => `Версія ${version}`,
      qrHint: 'Відскануйте камерою телефона',
      ctaDownload: 'Стати тестувальником',
      ctaReleases: 'Усі версії',
      installNote:
        'Ви приймете запрошення і встановите TechTok через Play Store — без ручного встановлення APK.',
    },
    footer: {
      tagline: 'TechTok — новини технологій і науки одним рухом.',
      sourceCode: 'Початковий код',
      license: 'Ліцензія MIT',
      privacy: 'Конфіденційність',
      deleteAccount: 'Видалення облікового запису',
      tester: 'Стати тестувальником',
    },
    doc: {
      back: '← Назад до TechTok',
      updated: (date) => `Оновлено ${date}`,
    },
    tester: {
      metaTitle: 'Стати тестувальником TechTok',
      metaDescription:
        'Щоб вийти в Google Play, TechTok потребує двох тижнів закритого тестування і дюжини тестувальників. Що для цього потрібно і як долучитися.',
      title: 'Стати тестувальником TechTok',
      intro:
        'TechTok готовий і працює. Але перш ніж Google пустить його в Play Store, застосунок має два тижні пройти закрите тестування з дюжиною живих людей. Саме про це просить ця сторінка — приблизно хвилина на день протягом чотирнадцяти днів.',
      whyTitle: 'Навіщо це потрібно',
      whyBody:
        'Google вимагає, щоб кожен новий застосунок з особистого акаунта розробника пройшов закрите тестування: щонайменше 12 тестувальників, які безперервно беруть участь 14 днів поспіль. Немає тесту — немає публікації. Правило придумали, щоб у Play Store не потрапляло сміття, і обійти його неможливо.',
      askTitle: 'Що знадобиться від вас',
      ask: [
        'Телефон на Android із Play Store і акаунт Google, під яким ви до нього увійшли.',
        'Встановити TechTok і залишитися в тесті всі 14 днів.',
        'Час від часу відкривати застосунок. Хвилини на день достатньо — це стрічка зі свайпами, тобто кілька карток.',
        'Розповісти, що дратує. Це необовʼязково, але саме заради цього тест і має сенс.',
      ],
      stepsTitle: 'Як долучитися',
      steps: [
        {
          title: 'Надішліть адресу свого акаунта Google',
          body: 'У закрите тестування Google пускає лише запрошені адреси, тому спершу ваша адреса має потрапити до списку. Потрібна та, під якою ви увійшли на своєму телефоні.',
        },
        {
          title: 'Дочекайтеся короткої відповіді',
          body: 'Я напишу, коли додам вас до списку, — зазвичай того ж дня. Лише після цього посилання нижче почне працювати.',
        },
        {
          title: 'Прийміть запрошення',
          body: 'Відкрийте посилання на телефоні або наведіть на QR-код камеру і натисніть кнопку, яка робить вас тестувальником.',
        },
        {
          title: 'Встановіть з Google Play',
          body: 'Одразу після цього відкриється звичайна сторінка в Play Store. Ставте як завжди — жодних APK вручну, оновлення прийдуть самі.',
        },
        {
          title: 'Користуйтеся два тижні',
          body: 'Заглядайте до застосунку час від часу протягом 14 днів і не виходьте з тесту. Достроковий вихід збиває лічильник нижче 12 і обнуляє відлік для всіх, тож якщо потрібно вийти — просто скажіть заздалегідь.',
        },
      ],
      qrHint: 'Наведіть камеру телефона',
      ctaEmail: 'Надіслати свою адресу',
      ctaOptIn: 'Відкрити запрошення',
      mailSubject: 'Тестування TechTok',
      mailBody:
        'Привіт! Хочу долучитися до закритого тестування TechTok. Адреса мого акаунта Google: ',
      perksTitle: 'Що ви отримаєте',
      perksBody:
        'Тестувальники безкоштовно залишають собі TechTok Plus — платний тариф, без оплати, стільки, скільки захочуть, скільки б він потім не коштував іншим.',
      feedbackTitle: 'Зворотний звʼязок',
      feedbackBody:
        'Кривий переклад, беззмістовна картка, виліт, кнопка не на місці, бракує джерела — пишіть на ту саму адресу. Наприкінці тесту Google запитує, що сказали тестувальники і що завдяки цьому змінилося, тож ваші зауваження справді потраплять у цю відповідь.',
      privacyTitle: 'Що буде з вашою адресою',
      privacyBody:
        'Вона потрапить до списку тестувальників у Google Play Console і більше нікуди. Жодних розсилок, нікому не передається. Якщо ви потім увійдете в застосунок, TechTok збереже ідентифікатор вашого акаунта Google, адресу пошти та відображуване імʼя — і більше нічого про вас.',
      privacyLink: 'Політика конфіденційності',
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
      title: 'Dołącz do testów',
      subtitle: 'Zeskanuj kod QR albo kliknij przycisk, aby zostać testerem w Google Play.',
      version: (version) => `Wersja ${version}`,
      qrHint: 'Zeskanuj aparatem telefonu',
      ctaDownload: 'Zostań testerem',
      ctaReleases: 'Wszystkie wersje',
      installNote:
        'Zaakceptujesz zaproszenie i zainstalujesz TechTok przez Play Store — bez ręcznej instalacji APK.',
    },
    footer: {
      tagline: 'TechTok — wiadomości technologiczne i naukowe w jednym geście.',
      sourceCode: 'Kod źródłowy',
      license: 'Licencja MIT',
      privacy: 'Prywatność',
      deleteAccount: 'Usuwanie konta',
      tester: 'Zostań testerem',
    },
    doc: {
      back: '← Powrót do TechTok',
      updated: (date) => `Ostatnia aktualizacja: ${date}`,
    },
    tester: {
      metaTitle: 'Zostań testerem TechTok',
      metaDescription:
        'Zanim TechTok trafi do Google Play, musi przejść dwutygodniowe testy zamknięte z kilkunastoma testerami. Oto, co to oznacza i jak dołączyć.',
      title: 'Zostań testerem TechTok',
      intro:
        'TechTok jest gotowy i działa. Zanim jednak Google wpuści go do Play Store, aplikacja musi spędzić dwa tygodnie w testach zamkniętych z kilkunastoma prawdziwymi osobami. O to właśnie prosi ta strona — mniej więcej minuta dziennie przez czternaście dni.',
      whyTitle: 'Dlaczego to konieczne',
      whyBody:
        'Google wymaga, aby każda nowa aplikacja z osobistego konta dewelopera przeszła testy zamknięte: co najmniej 12 testerów zapisanych nieprzerwanie przez 14 dni z rzędu. Bez testów nie ma publikacji. Zasada ma trzymać śmieci z dala od Play Store i nie da się jej obejść.',
      askTitle: 'Czego to wymaga',
      ask: [
        'Telefonu z Androidem i Play Store oraz konta Google, na które jest zalogowany.',
        'Zainstalowania TechTok i pozostania w teście przez pełne 14 dni.',
        'Zaglądania do aplikacji od czasu do czasu. Minuta dziennie w zupełności wystarczy — to kanał przewijany gestem, czyli kilka kart.',
        'Powiedzenia mi, co irytuje. To nieobowiązkowe, ale właśnie po to warto robić ten test.',
      ],
      stepsTitle: 'Jak dołączyć',
      steps: [
        {
          title: 'Wyślij adres swojego konta Google',
          body: 'Do testów zamkniętych Google wpuszcza wyłącznie zaproszone adresy, więc najpierw Twój adres musi trafić na listę. Podaj ten, na który zalogowany jest Twój telefon.',
        },
        {
          title: 'Poczekaj na krótką odpowiedź',
          body: 'Odezwę się, gdy dodam Cię do listy — zwykle tego samego dnia. Dopiero wtedy poniższy link zaproszenia zacznie działać.',
        },
        {
          title: 'Przyjmij zaproszenie',
          body: 'Otwórz link na telefonie albo zeskanuj kod QR aparatem i kliknij przycisk, który czyni Cię testerem.',
        },
        {
          title: 'Zainstaluj z Google Play',
          body: 'Zaraz potem otworzy się zwykła strona w Play Store. Instaluj jak zawsze — żadnych plików APK ręcznie, aktualizacje przyjdą same.',
        },
        {
          title: 'Korzystaj przez dwa tygodnie',
          body: 'Zaglądaj do aplikacji co jakiś czas przez najbliższe 14 dni i nie wypisuj się z testu. Wcześniejsze wyjście zbija licznik poniżej 12 i zeruje odliczanie dla wszystkich, więc jeśli musisz zrezygnować, daj znać wcześniej.',
        },
      ],
      qrHint: 'Zeskanuj aparatem telefonu',
      ctaEmail: 'Wyślij swój adres',
      ctaOptIn: 'Otwórz zaproszenie',
      mailSubject: 'Testy TechTok',
      mailBody: 'Cześć! Chcę dołączyć do testów zamkniętych TechTok. Adres mojego konta Google: ',
      perksTitle: 'Co z tego masz',
      perksBody:
        'Testerzy zatrzymują TechTok Plus za darmo, na tak długo, jak zechcą — płatny plan bez opłaty, niezależnie od tego, ile będzie kosztował resztę.',
      feedbackTitle: 'Uwagi',
      feedbackBody:
        'Kiepskie tłumaczenie, karta bez sensu, awaria, przycisk nie tam, gdzie trzeba, brakujące źródło — wyślij to na ten sam adres. Na koniec testu Google pyta, co powiedzieli testerzy i co się dzięki temu zmieniło, więc Twoje uwagi naprawdę trafiają do tej odpowiedzi.',
      privacyTitle: 'Co się dzieje z Twoim adresem',
      privacyBody:
        'Trafia na listę testerów w Google Play Console i nigdzie indziej. Żadnej listy mailingowej, nikomu nieprzekazywany. Jeśli potem zalogujesz się w aplikacji, TechTok zapisze identyfikator Twojego konta Google, adres e-mail i nazwę wyświetlaną — i nic więcej o Tobie.',
      privacyLink: 'Polityka prywatności',
    },
  },
};
