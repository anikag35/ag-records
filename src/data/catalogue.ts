/**
 * The catalogue: everything the site renders.
 *
 * All copy lives here rather than inside components, so editing the words
 * never means touching markup. Commit waveforms are joined on `repo` from
 * commits.json, which `npm run commits` regenerates.
 */

import commits from "./commits.json";
import qc from "./qc.json";

export type Link = {
  label: string;
  href: string;
};

export type Release = {
  /** Track number, shown in the list. */
  n: number;
  title: string;
  /** Repo name, and the key into commits.json. */
  repo: string;
  /** The "featured artists" column: what it's built with. */
  stack: string[];
  /** The "duration" column. */
  when: string;
  /** One line, shown collapsed. Has to carry the project on its own. */
  blurb: string;
  brief: string;
  color: string;
  /** The expanded liner notes. Each string is a paragraph. */
  notes: string[];
  links: Link[];
  /** Looping clip, relative to /public. Null until one is recorded. */
  clip: string | null;
  /** Poster frame for the clip. */
  poster: string | null;
  /** Optional flag shown as a small tag, e.g. a hackathon or a lab. */
  tag?: string;
};

export type Sleeve = {
  title: string;
  body: string;
};

export type Credit = {
  org: string;
  short: string;
  role: string;
  when: string;
  place: string;
  summary: string;
  sleeves: Sleeve[];
};

export const label = {
  name: "AG Records",
  catalogue: "AG-001",
  artist: "Anika Giri",
  tagline: "Systems and AI reliability",
  /** The sentence under the title. Two lines at most. */
  standfirst:
    "I build infrastructure that makes AI systems trustworthy: evaluating them without bias, stopping them being hijacked, letting them act on production safely. I study computer science at UC Berkeley and do research at the Sky Computing Lab. What I care about most is reliability and distributed systems: software that stays correct when parts of it fail.",
  location: "Berkeley, California",
};

/**
 * Ordered as a tracklist, not a CV: strongest first.
 *
 * Track one has to be legible to someone who knows nothing about the work,
 * which is why the agent-security project leads rather than the largest one.
 */
export const releases: Release[] = [
  {
    n: 1,
    title: "tripwire",
    repo: "tripwire",
    color: "#e99a80",
    stack: ["TypeScript", "MCP"],
    when: "Oct 2026",
    tag: "CalHacks 2026",
    blurb:
      "A drop-in proxy that sits between an AI agent and its tools, and refuses the actions it was tricked into taking.",
    brief:
      "Anything an agent reads can carry instructions aimed at the agent. tripwire sits between the agent and its tools and blocks actions the user never asked for. Built with teammates in two days at CalHacks.",
    notes: [
      "Agents that can use tools can be talked into using them badly. A web page, an email, or a file an agent reads can carry instructions aimed at the agent rather than the user, and from the model's side, retrieved text and genuine instructions look alike.",
      "tripwire sits in front of the Model Context Protocol as a proxy, so it needs no change to the agent or the tools. It watches the gap between what the user asked for and what the agent is about to do, and blocks actions that only make sense if something in the content was giving orders.",
      "Built in two days at CalHacks. The commit waveform shows exactly that: one dense burst and nothing either side.",
    ],
    links: [{ label: "Source", href: "https://github.com/anikag35/tripwire" }],
    clip: null,
    poster: null,
  },
  {
    n: 2,
    title: "double-blind",
    repo: "double-blind",
    color: "#a7bccd",
    stack: ["Rust", "Distributed"],
    when: "Aug to Nov 2026",
    blurb:
      "A fault-tolerant evaluation platform for language models, built to remove the biases that make model comparisons lie.",
    brief:
      "LLM judges change their verdict when they know who wrote what. double-blind hides model identity, randomizes answer order, and measures how far the verdict shifts when blinding is off. Kill a worker mid-run and its task is reassigned within 30 seconds, with no double-writes.",
    notes: [
      "Using a language model to judge other models is standard practice and quietly unreliable. Judges favour whichever answer they saw first, prefer longer responses, and recognise their own writing. An evaluation that ignores this produces confident numbers that mean very little.",
      "double-blind runs evaluations with the conditions that cause those effects controlled (identities hidden, order randomised and counterbalanced), and distributes the work so a failed node loses one judgement rather than the whole run.",
      "Written in Rust, and the longest-running thing here: two and a half months of steady work rather than a sprint.",
    ],
    links: [
      { label: "Source", href: "https://github.com/anikag35/double-blind" },
    ],
    clip: null,
    poster: null,
  },
  {
    n: 3,
    title: "algoscope",
    repo: "algoscope",
    color: "#a9c5a3",
    stack: ["Rust", "ratatui"],
    when: "Nov 2026",
    tag: "on crates.io",
    blurb:
      "A terminal visualizer for sorting and pathfinding you can scrub backwards through, one comparison at a time.",
    brief:
      "Each algorithm runs once and records every step in a reversible log. The screen is drawn purely from that log and a cursor, so stepping backward costs the same as stepping forward. Published on crates.io.",
    notes: [
      "The hard part of an algorithm visualizer is not the algorithms, it is the animation state. The obvious design has each algorithm pause itself mid-run, which reads naturally and is a dead end: the algorithm owns control flow, so pausing means parking a thread and stepping backwards is impossible.",
      "So nothing here animates itself. Each algorithm runs to completion immediately and records its operations into a reversible event log. Rendering becomes a pure function of (trace, cursor), and stepping back, scrubbing and reverse playback all collapse into cursor arithmetic. The invariant that buys it: every step carries enough information to undo itself. Property tests assert that applying every step forward and then backward returns bit-for-bit to the start.",
      "Published on crates.io, with the algorithm core split out as a library that has no dependency on the terminal, which is what will let it run in a browser.",
    ],
    links: [
      { label: "Source", href: "https://github.com/anikag35/algoscope" },
      { label: "crates.io", href: "https://crates.io/crates/algoscope" },
      { label: "Docs", href: "https://docs.rs/algoscope" },
    ],
    clip: null,
    poster: null,
  },
  {
    n: 4,
    title: "cloudscape",
    repo: "cloudscape",
    color: "#e3c98a",
    stack: ["TypeScript", "AWS"],
    when: "Apr 2026",
    blurb:
      "An on-call agent for AWS that investigates an alert, finds the root cause, proposes a fix, and writes the post-mortem.",
    brief:
      "When an alarm fires, cloudscape correlates CloudWatch metrics, logs, and CloudTrail events to rank probable root causes and draft remediation steps. It investigates other AWS accounts through short-lived assumed roles, with no stored credentials. Co-built, and won a Perplexity-partnered hackathon.",
    notes: [
      "On-call work is mostly retrieval under time pressure: pull the metrics, read the logs, check what deployed, form a theory, test it. That shape suits an agent, as long as it shows its reasoning rather than asserting an answer.",
      "cloudscape walks an alert through investigation to root cause to remediation, then drafts the post-mortem from what it actually did, so the write-up matches the investigation instead of being reconstructed afterwards.",
    ],
    links: [
      { label: "Source", href: "https://github.com/anikag35/cloudscape" },
    ],
    clip: null,
    poster: null,
  },
];

export const shelved: Release[] = [
  {
    n: 5,
    title: "gepa-polyglot",
    repo: "gepa-polyglot",
    color: "#c3b6d6",
    stack: ["Python", "gRPC", "Rust", "TypeScript"],
    when: "Mar to Aug 2026",
    tag: "Sky Computing Lab",
    blurb:
      "A bidirectional gRPC bridge that lets prompt optimization run from TypeScript or Rust while the evaluators stay native.",
    brief:
      "GEPA's research lives in Python. The systems people want to optimize usually do not. This bridge drives it from TypeScript or Rust while evaluation stays native.",
    notes: [
      "GEPA optimizes prompts by reflecting on how they failed. The research lives in Python; the systems people want to optimize usually do not.",
      "This is the interface between them: a bidirectional gRPC service that drives optimization from TypeScript or Rust, with evaluation staying in whichever language the system under test is written in. No reimplementing your evaluator in Python to use the optimizer.",
      "Built at UC Berkeley's Sky Computing Lab, across five months.",
    ],
    links: [
      { label: "Source", href: "https://github.com/anikag35/gepa-polyglot" },
      { label: "GEPA", href: "https://github.com/gepa-ai/gepa" },
    ],
    clip: null,
    poster: null,
  },
];

/** Experience, framed as the back catalogue. */
export const discography: Credit[] = [
  {
    org: "Amazon Web Services",
    short: "AWS",
    role: "Software Development Engineering Intern",
    when: "May to Aug 2026",
    place: "Arlington, VA",
    summary:
      "A Rust backend on AWS Lambda that lets any resolver group trigger operational runbooks, with no onboarding.",
    sleeves: [
      {
        title: "95% fewer calls",
        body: "Replaced an O(n) authorization scan with an O(1) DynamoDB lookup, cutting redundant authorization calls by 95%.",
      },
      {
        title: "Run from any ticket",
        body: "Shipped on-demand runbook execution from any ticket comment. DynamoDB conditional writes keep concurrent requests atomic, and EMF metrics make every run observable.",
      },
      {
        title: "Owned the design",
        body: "Presented the namespace-aware authorization and identity model in design review, revised it from that feedback, and reviewed code across the service.",
      },
    ],
  },
  {
    org: "UC Berkeley Sky Computing Lab",
    short: "Sky Lab",
    role: "Undergraduate Researcher, part‑time",
    when: "Mar 2026 to present",
    place: "Berkeley, CA",
    summary:
      "Built gepa-polyglot: a gRPC service that turns GEPA's evaluation callback into a network request, so candidates are scored in TypeScript or Rust without porting evaluators to Python.",
    sleeves: [
      {
        title: "One connection per run",
        body: "A multi-threaded server carries a whole optimization run over one long-lived connection instead of reconnecting per evaluation. A dropped client becomes a terminal error, not a hung run.",
      },
      {
        title: "One function call",
        body: "TypeScript and Rust SDKs with generated protobuf bindings, connection retries and typed errors. Adopting the service is one call, not a hand-written gRPC client.",
      },
    ],
  },
  {
    org: "SkedAI",
    short: "SkedAI",
    role: "Software Engineering Intern",
    when: "Jan to Apr 2026",
    place: "Berkeley, CA",
    summary:
      "SkedAI is a calendar that replans a student's week from plain-language input.",
    sleeves: [
      {
        title: "Weights, not rules",
        body: "Extended the constraint model so requests resolve into weighted soft constraints in Google OR-Tools, replacing hand-written rules.",
      },
      {
        title: "Warm starts",
        body: "Kept full-week replans interactive by starting each solve from the previous schedule instead of from scratch.",
      },
    ],
  },
];

/** The back-of-sleeve credits. */
export const linerNotes = {
  firstSingle: {
    title: "First single",
    body: "A looping app for dancers, built at hackTJ. Record a phrase, loop it, and keep your hands free while you work the choreography. First thing I shipped that someone else used, and the reason this site is laid out like a record.",
  },
  recordedAt: ["Berkeley, CA", "Arlington, VA", "Northern Virginia"],
  /** TODO: swap in real playlist links. */
  playlists: [
    { label: "for writing Rust at 2am", href: "#" },
    { label: "leetcode grind", href: "#" },
    { label: "walking to class", href: "#" },
  ],
  contact: [{ label: "GitHub", href: "https://github.com/anikag35" }],
};

export type Waveform = {
  commits: number;
  first: string | null;
  last: string | null;
  days: number;
  peak: number;
  flaw?: { sha: string; at: number; date: string } | null;
  bars: number[];
};

export type Catch = {
  commit: string;
  line: string;
  href: string;
};

export function catchFor(repo: string): Catch | null {
  const entry = (qc as Record<string, { commit: string; line: string }>)[repo];
  if (!entry) return null;
  return { ...entry, href: `https://github.com/anikag35/${repo}/commit/${entry.commit}` };
}

/** Commit waveform for a repo, or null if it was never fetched. */
export function waveformFor(repo: string): Waveform | null {
  return (commits as Record<string, Waveform>)[repo] ?? null;
}
