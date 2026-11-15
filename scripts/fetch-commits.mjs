#!/usr/bin/env node
/**
 * Pull real commit history for each release and bucket it into a waveform.
 *
 * Run manually (`npm run commits`) rather than at build time, and commit the
 * result. Three reasons: the site then builds with no network and no GitHub
 * token, deploys are reproducible instead of silently changing whenever
 * someone pushes, and an API hiccup can't fail a deploy.
 *
 * Only commits authored by the account below are counted. A waveform that
 * included other people's work would be a pretty lie, which is the opposite
 * of the point.
 */

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const AUTHOR = "anikag35";
const REPOS = [
  "algoscope",
  "double-blind",
  "tripwire",
  "cloudscape",
  "gepa-polyglot",
];

/** How many bars each waveform gets. Enough to show shape, few enough to stay legible small. */
const BUCKETS = 32;

/** Baseline height, so quiet stretches read as a noise floor rather than a gap. */
const FLOOR = 0.06;

const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/data/commits.json",
);

const QC = JSON.parse(
  await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/qc.json"), "utf8"),
);

async function commitDates(repo) {
  const { stdout } = await run("gh", [
    "api",
    "--paginate",
    `repos/${AUTHOR}/${repo}/commits?author=${AUTHOR}&per_page=100`,
    "--jq",
    '.[] | "\\(.sha) \\(.commit.author.date)"',
  ]);
  return stdout
    .split("\n")
    .filter(Boolean)
    .map((row) => {
      const [sha, date] = row.split(" ");
      return { sha, t: new Date(date).getTime() };
    })
    .sort((a, b) => a.t - b.t);
}

function flawOf(repo, commits) {
  const want = QC[repo]?.commit;
  if (!want || commits.length === 0) return null;
  const hit = commits.find((c) => c.sha.startsWith(want));
  if (!hit) return null;
  const start = commits[0].t;
  const span = Math.max(commits[commits.length - 1].t - start, 1);
  return { sha: hit.sha.slice(0, 7), at: (hit.t - start) / span, date: isoDay(hit.t) };
}

/**
 * Bucket timestamps into a fixed number of bars spanning first commit to last.
 *
 * Normalised against the repo's own peak rather than a global one, so a
 * two-day hackathon and a five-month project are each readable on their own
 * terms. The contrast between those shapes is the interesting part.
 */
function waveform(times) {
  if (times.length === 0) return { bars: [], peak: 0 };

  const start = times[0];
  const end = times[times.length - 1];
  const span = Math.max(end - start, 1);
  const counts = new Array(BUCKETS).fill(0);

  for (const t of times) {
    const i = Math.min(BUCKETS - 1, Math.floor(((t - start) / span) * BUCKETS));
    counts[i] += 1;
  }

  const peak = Math.max(...counts);
  if (peak === 0) return { bars: new Array(BUCKETS).fill(FLOOR), peak: 0 };

  // Square-root scaling, then a light 3-point smooth. Raw counts render as a
  // sparse bar code -- one tall spike and a row of gaps -- because the work
  // really was bursty. The root compresses the spike so quieter weeks stay
  // visible, and the smoothing gives the continuity an audio waveform has.
  // Both are presentation choices on real data, not invented data.
  // ^0.6 rather than a square root: enough compression that quiet weeks
  // stay visible, not so much that a genuine burst flattens into the rest.
  const scaled = counts.map((c) => (c / peak) ** 0.6);
  const smoothed = scaled.map((_, i) => {
    const window = [scaled[i - 1], scaled[i], scaled[i + 1]].filter(
      (v) => v !== undefined,
    );
    return window.reduce((a, b) => a + b, 0) / window.length;
  });

  return {
    // 0..1, so the renderer needs no knowledge of commit counts.
    bars: smoothed.map((v) => FLOOR + (1 - FLOOR) * v),
    peak,
  };
}

function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

const data = {};

for (const repo of REPOS) {
  process.stdout.write(`  ${repo} ... `);
  try {
    const commits = await commitDates(repo);
    const times = commits.map((c) => c.t);
    const { bars, peak } = waveform(times);
    data[repo] = {
      commits: times.length,
      first: times.length ? isoDay(times[0]) : null,
      last: times.length ? isoDay(times[times.length - 1]) : null,
      days: times.length
        ? Math.max(
            1,
            Math.round(
              (times[times.length - 1] - times[0]) / (1000 * 60 * 60 * 24),
            ),
          )
        : 0,
      peak,
      flaw: flawOf(repo, commits),
      bars,
    };
    const flaw = data[repo].flaw;
    console.log(
      `${times.length} commits` +
        (flaw ? `, flaw ${flaw.sha} on ${flaw.date} at ${(flaw.at * 100).toFixed(1)}%` : ""),
    );
  } catch (error) {
    // A missing or renamed repo should not take the whole refresh down.
    console.log(`SKIPPED (${error.message.split("\n")[0]})`);
  }
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);
console.log(`\nwrote ${OUT}`);
