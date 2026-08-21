import type { Language } from '@techtok/shared';

export interface TranslationFixture {
  readonly name: string;
  readonly input: {
    readonly lang: Language;
    readonly cardTitle: string;
    readonly summary: string;
    readonly whyItMatters?: string;
  };
  readonly llmResponse: string;
}

export const TRANSLATION_FIXTURES: TranslationFixture[] = [
  {
    name: 'ai model release, ru',
    input: {
      lang: 'ru',
      cardTitle: 'Tiny Lab Matches GPT-4 With a Fraction of the Compute',
      summary:
        'A small research lab open-sourced model weights trained far more cheaply than usual, claiming benchmark parity with much larger closed models. Independent evaluators are already reproducing the results.',
      whyItMatters: 'Cheaper frontier-grade models could reshape who gets to build with AI.',
    },
    llmResponse: JSON.stringify({
      cardTitle: 'Маленькая лаборатория повторила GPT-4 при минимальных вычислениях',
      summary:
        'Небольшая исследовательская лаборатория выложила в открытый доступ веса модели, обученной значительно дешевле обычного, заявив о паритете с гораздо более крупными закрытыми моделями. Независимые эксперты уже воспроизводят результаты.',
      whyItMatters: 'Более дешёвые топовые модели могут изменить круг тех, кто строит на базе ИИ.',
    }),
  },
  {
    name: 'security vulnerability, uk',
    input: {
      lang: 'uk',
      cardTitle: 'Patch Now: RCE Bug Hits a Popular SSH Library',
      summary:
        'Researchers disclosed a remote code execution flaw in a widely-used open-source SSH library that underpins much of cloud infrastructure. Patches are already out, and unpatched servers are being scanned within hours.',
      whyItMatters:
        'If you run servers with this library, patching today matters more than reading about it.',
    },
    llmResponse: JSON.stringify({
      cardTitle: 'Оновлюйтесь негайно: критична вразливість у популярній SSH-бібліотеці',
      summary:
        'Дослідники розкрили вразливість віддаленого виконання коду в широко використовуваній відкритій SSH-бібліотеці, на якій тримається значна частина хмарної інфраструктури. Патчі вже вийшли, а непропатчені сервери сканують вже за кілька годин.',
      whyItMatters:
        'Якщо у вас працюють сервери з цією бібліотекою, оновлення сьогодні важливіше за читання новин.',
    }),
  },
  {
    name: 'gadget launch, pl',
    input: {
      lang: 'pl',
      cardTitle: 'This Foldable Phone Might Actually Last Two Days',
      summary:
        'A major phone maker unveiled a foldable with a new silicon-carbon battery cell, claiming two full days of typical use. Reviewers with pre-release units measured roughly 1.8 days under mixed usage.',
      whyItMatters:
        'Foldables have always traded battery life for the hinge — this is the first real fix.',
    },
    llmResponse: JSON.stringify({
      cardTitle: 'Ten składany telefon może naprawdę wytrzymać dwa dni',
      summary:
        'Duży producent telefonów zaprezentował składak z nowym ogniwem krzemowo-węglowym, obiecując dwa pełne dni typowego użytkowania. Recenzenci z przedpremierowymi egzemplarzami zmierzyli około 1,8 dnia przy mieszanym użytkowaniu.',
      whyItMatters:
        'Składane telefony zawsze poświęcały baterię na rzecz zawiasu — to pierwsza realna poprawa.',
    }),
  },
  {
    name: 'card with no whyItMatters, ru',
    input: {
      lang: 'ru',
      cardTitle: 'Astronomers Just Found the Universe’s Oldest Known Galaxy',
      summary:
        'Using a new space telescope, astronomers identified a galaxy whose light has traveled longer than any previously confirmed. It pushes back the record for the earliest observed structure by roughly 100 million years.',
    },
    llmResponse: JSON.stringify({
      cardTitle: 'Астрономы нашли самую старую известную галактику во Вселенной',
      summary:
        'С помощью нового космического телескопа астрономы обнаружили галактику, свет от которой шёл дольше, чем от любого ранее подтверждённого объекта. Это отодвигает рекорд самой ранней наблюдаемой структуры примерно на 100 миллионов лет.',
    }),
  },
];
