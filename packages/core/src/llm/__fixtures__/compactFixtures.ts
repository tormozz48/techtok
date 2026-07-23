// Golden fixtures for the compact-article reader (D23). Each fixture pairs a
// realistic compact-article request with a hand-curated JSON block list
// shaped exactly as Bedrock would return it (single-pass compress+translate,
// self-critique-in-call for non-English targets). Recording real Converse
// output requires live model access not available in this environment (same
// constraint as `cardFixtures.ts`/`translationFixtures.ts`) — these fixtures
// pin the prompt/schema contract in the same golden-file shape so a real
// recorded transcript can drop in later without changing the test harness.
// CI never calls Bedrock — every compactArticle test runs against a fake
// LlmProvider returning these fixed strings.

import type { Language } from '@techtok/shared';

export interface CompactFixture {
  readonly name: string;
  readonly input: {
    readonly lang: Language;
    readonly title: string;
    readonly sourceName: string;
    readonly articleText: string;
    readonly figures: { index: number; caption?: string }[];
  };
  readonly llmResponse: string;
}

export const COMPACT_FIXTURES: CompactFixture[] = [
  {
    name: 'battery material article, en, with a figure',
    input: {
      lang: 'en',
      title: 'Scientists Find New Battery Material',
      sourceName: 'ScienceDaily',
      articleText:
        'Researchers at a national lab discovered a silicon-carbon composite that could double battery life in consumer electronics. The material was tested across a thousand charge cycles with minimal degradation, and the team says manufacturing does not require new tooling.',
      figures: [{ index: 0, caption: 'The battery test rig' }],
    },
    llmResponse: JSON.stringify({
      blocks: [
        {
          type: 'paragraph',
          text: 'Researchers at a national lab say they have found a battery material that could double how long your phone or laptop lasts on a charge.',
        },
        { type: 'image', figureIndex: 0, caption: 'The battery test rig' },
        {
          type: 'paragraph',
          text: 'The new silicon-carbon composite held up across a thousand charge cycles with barely any degradation, and — crucially — it can be made on existing manufacturing lines.',
        },
        {
          type: 'heading',
          text: 'Why it matters',
        },
        {
          type: 'paragraph',
          text: 'Battery breakthroughs rarely reach real devices because they need new factories. This one might not.',
        },
      ],
    }),
  },
  {
    name: 'security vulnerability article, ru, translated with no figures',
    input: {
      lang: 'ru',
      title: 'Patch Now: RCE Bug Hits a Popular SSH Library',
      sourceName: 'Hacker News',
      articleText:
        'A remote code execution vulnerability was disclosed in a widely used open-source SSH library underpinning much of cloud infrastructure. Patches are already available, and scans of unpatched servers began within hours of disclosure.',
      figures: [],
    },
    llmResponse: JSON.stringify({
      blocks: [
        {
          type: 'paragraph',
          text: 'В широко используемой SSH-библиотеке с открытым исходным кодом обнаружена уязвимость удалённого выполнения кода.',
        },
        {
          type: 'list',
          items: [
            'Патчи уже доступны',
            'Сканирование непропатченных серверов началось в течение нескольких часов',
          ],
        },
        {
          type: 'quote',
          text: 'Если вы используете эту библиотеку, обновление важнее, чем чтение новостей.',
        },
      ],
    }),
  },
];
