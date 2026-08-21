export interface CardFixture {
  readonly name: string;
  readonly input: { readonly title: string; readonly sourceName: string; readonly text: string };
  readonly llmResponse: string;
}

export const CARD_FIXTURES: CardFixture[] = [
  {
    name: 'ai model release',
    input: {
      title: 'Startup releases open-weight model matching GPT-4 on benchmarks',
      sourceName: 'Hacker News',
      text: 'A small research lab released the weights for a language model trained on a fraction of the usual compute budget, claiming benchmark parity with much larger closed models. Independent evaluators have started reproducing the results.',
    },
    llmResponse: JSON.stringify({
      cardTitle: 'Tiny Lab Matches GPT-4 With a Fraction of the Compute',
      summary:
        'A small research lab open-sourced model weights trained far more cheaply than usual, claiming benchmark parity with much larger closed models. Independent evaluators are already reproducing the results.',
      whyItMatters: 'Cheaper frontier-grade models could reshape who gets to build with AI.',
      primaryTopic: 'ai',
      topics: ['ai', 'dev'],
      lang: 'en',
    }),
  },
  {
    name: 'security vulnerability',
    input: {
      title: 'Critical flaw found in widely-used SSH library',
      sourceName: 'The Verge',
      text: 'Researchers disclosed a remote code execution vulnerability affecting a popular open-source SSH library used across cloud infrastructure. Patches are already available; unpatched servers are being scanned within hours of disclosure.',
    },
    llmResponse: JSON.stringify({
      cardTitle: 'Patch Now: RCE Bug Hits a Popular SSH Library',
      summary:
        'Researchers disclosed a remote code execution flaw in a widely-used open-source SSH library that underpins much of cloud infrastructure. Patches are already out, and unpatched servers are being scanned within hours.',
      whyItMatters:
        'If you run servers with this library, patching today matters more than reading about it.',
      primaryTopic: 'security',
      topics: ['security', 'dev'],
      lang: 'en',
    }),
  },
  {
    name: 'gadget launch',
    input: {
      title: 'New foldable phone ships with a battery that lasts two days',
      sourceName: 'The Verge',
      text: 'A major phone maker unveiled a foldable device with a silicon-carbon battery cell, claiming two full days of typical use. Reviewers who tested pre-release units confirmed roughly 1.8 days under mixed usage.',
    },
    llmResponse: JSON.stringify({
      cardTitle: 'This Foldable Phone Might Actually Last Two Days',
      summary:
        'A major phone maker unveiled a foldable with a new silicon-carbon battery cell, claiming two full days of typical use. Reviewers with pre-release units measured roughly 1.8 days under mixed usage.',
      whyItMatters:
        'Foldables have always traded battery life for the hinge — this is the first real fix.',
      primaryTopic: 'gadgets',
      topics: ['gadgets'],
      lang: 'en',
    }),
  },
  {
    name: 'startup funding',
    input: {
      title: 'Climate-tech startup raises $40M to scale direct air capture',
      sourceName: 'Hacker News',
      text: 'A direct air capture startup closed a $40 million Series B to build its second commercial facility, betting that falling costs per ton of captured CO2 make the economics work without subsidies within five years.',
    },
    llmResponse: JSON.stringify({
      cardTitle: 'Direct Air Capture Startup Bets $40M on Subsidy-Free Economics',
      summary:
        'A direct air capture startup raised a $40 million Series B for its second commercial facility. It is betting falling per-ton capture costs make the economics work without subsidies within five years.',
      whyItMatters:
        'Carbon removal only matters at scale — this is a real bet that the unit economics can get there.',
      primaryTopic: 'startups',
      topics: ['startups', 'science'],
      lang: 'en',
    }),
  },
  {
    name: 'space launch',
    input: {
      title: 'Private rocket company completes first orbital reflight in a week',
      sourceName: 'ScienceDaily',
      text: 'A private launch provider reused the same first-stage booster twice within seven days, the fastest turnaround yet for an orbital-class rocket, cutting refurbishment time with a new heat-shield coating.',
    },
    llmResponse: JSON.stringify({
      cardTitle: 'A Rocket Booster Just Flew Twice in One Week',
      summary:
        'A private launch provider reused the same first-stage booster twice within seven days, the fastest turnaround yet for an orbital-class rocket. A new heat-shield coating cut refurbishment time.',
      whyItMatters:
        'Faster reuse turnaround is the difference between rockets and airplanes, cost-wise.',
      primaryTopic: 'space',
      topics: ['space'],
      lang: 'en',
    }),
  },
  {
    name: 'bio research',
    input: {
      title: 'Gene therapy trial restores partial hearing in children born deaf',
      sourceName: 'ScienceDaily',
      text: 'A small clinical trial delivered a gene therapy to children born with a specific inherited form of deafness, restoring measurable hearing in most participants within six months, with no serious adverse events reported.',
    },
    llmResponse: JSON.stringify({
      cardTitle: 'Gene Therapy Gives Deaf Children Measurable Hearing',
      summary:
        'A small clinical trial delivered gene therapy to children born with an inherited form of deafness. Most participants gained measurable hearing within six months, with no serious adverse events.',
      whyItMatters:
        'This is one of the first gene therapies to reverse, not just halt, a sensory condition.',
      primaryTopic: 'bio',
      topics: ['bio', 'science'],
      lang: 'en',
    }),
  },
  {
    name: 'dev tooling',
    input: {
      title: 'Popular build tool ships a rewrite that cuts cold-start times 10x',
      sourceName: 'Hacker News',
      text: 'The maintainers of a widely-used JavaScript build tool released a from-scratch rewrite in a compiled language, reporting cold-start build times roughly ten times faster on large monorepos in early benchmarks.',
    },
    llmResponse: JSON.stringify({
      cardTitle: 'This Build Tool Rewrite Makes Cold Starts 10x Faster',
      summary:
        'Maintainers of a widely-used JavaScript build tool shipped a from-scratch rewrite in a compiled language. Early benchmarks show cold-start build times roughly ten times faster on large monorepos.',
      whyItMatters:
        'If you have ever waited on a monorepo build, this is the kind of fix that gives you minutes back daily.',
      primaryTopic: 'dev',
      topics: ['dev'],
      lang: 'en',
    }),
  },
  {
    name: 'science discovery',
    input: {
      title: 'Astronomers detect the most distant galaxy yet observed',
      sourceName: 'ScienceDaily',
      text: 'Using a new space telescope, astronomers identified a galaxy whose light has traveled longer than any previously confirmed, pushing back the record for the earliest observed structure in the universe by roughly 100 million years.',
    },
    llmResponse: JSON.stringify({
      cardTitle: "Astronomers Just Found the Universe's Oldest Known Galaxy",
      summary:
        'Using a new space telescope, astronomers identified a galaxy whose light has traveled longer than any previously confirmed. It pushes back the record for the earliest observed structure by roughly 100 million years.',
      whyItMatters:
        'Every record like this rewrites part of the timeline for how galaxies actually formed.',
      primaryTopic: 'science',
      topics: ['science', 'space'],
      lang: 'en',
    }),
  },
  {
    name: 'non-english source',
    input: {
      title: 'Un laboratoire dévoile une batterie à recharge ultra-rapide',
      sourceName: 'ScienceDaily',
      text: "Des chercheurs ont présenté une batterie capable de se recharger à 80% en moins de trois minutes, grâce à un nouvel électrolyte solide, ouvrant la voie à des véhicules électriques rechargés aussi vite qu'un plein d'essence.",
    },
    llmResponse: JSON.stringify({
      cardTitle: 'This Battery Recharges to 80% in Under 3 Minutes',
      summary:
        'Researchers unveiled a battery using a new solid electrolyte that can recharge to 80% in under three minutes. That could make EV charging as fast as a gas station fill-up.',
      whyItMatters: 'Charging speed, not range, is the last real objection to switching to an EV.',
      primaryTopic: 'science',
      topics: ['science', 'gadgets'],
      lang: 'fr',
    }),
  },
];
