#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4321/ag-records";
const PATH = process.argv[2] ?? "/lab";
const OUT = ".shots";

const SIZES = [
  { name: "800x600", width: 800, height: 600, scale: 1, touch: false },
  { name: "1440x900", width: 1440, height: 900, scale: 1, touch: false },
  { name: "mobile", width: 390, height: 844, scale: 2, touch: true },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const problems = [];
const note = (size, text) => console.log(`[${size}] ${text}`);
const fail = (size, text) => {
  problems.push(`[${size}] ${text}`);
  console.log(`[${size}] FAIL ${text}`);
};

const audit = () => {
  const root = document.querySelector("[data-turntable]");
  const rect = (el) => el.getBoundingClientRect();
  const hits = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const word = rect(root.querySelector(".wordbox"));
  const back = root.querySelector(".back");
  const texts = [...root.querySelectorAll(".back .list, .back .panel:not([hidden]), .corner")].map(rect);
  const stickers = [...root.querySelectorAll(".sticker, .stamp, .pricetag")].map(rect);
  const rows = [...root.querySelectorAll(".list button")];
  const lineHeights = rows.map((row) => rect(row).height);
  const panel = root.querySelector(".panel:not([hidden])");
  const canvas = root.querySelector(".deck canvas");
  const wc = root.querySelector(".word");
  const inked = (c) => {
    if (!c.width || !c.height) return 0;
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 40) n++;
    return n;
  };
  return {
    selected: root.querySelector('[role="tab"][aria-selected="true"] .nm')?.textContent?.trim(),
    wordInside: word.top >= 0 && word.left >= 0 && word.right <= innerWidth + 0.5 && word.bottom <= innerHeight + 0.5,
    wordBox: [Math.round(word.top), Math.round(word.bottom), innerHeight],
    wordInk: inked(wc),
    recordInk: inked(canvas),
    stickerHits: stickers.filter((s) => texts.some((t) => hits(s, t))).length,
    backOverflow: Math.max(0, back.scrollHeight - back.clientHeight),
    panelPastBack: Math.max(0, Math.round(rect(panel).bottom - rect(back).bottom)),
    wrapped: rows.filter((row) => row.scrollWidth > row.clientWidth + 1).length,
    tallRows: lineHeights.filter((h) => h > Math.min(...lineHeights) * 1.4).length,
    sentences: (panel.querySelector(".brief")?.textContent ?? "").split(/(?<=\.)\s+/).filter(Boolean).length,
    width: wc.dataset.width,
    facts: panel.querySelector(".facts")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    squeeze: (() => {
      const data = wc.getContext("2d").getImageData(0, 0, wc.width, wc.height).data;
      let top = wc.height;
      for (let y = 0; y < wc.height && top === wc.height; y++)
        for (let x = 0; x < wc.width; x += 7) if (data[(y * wc.width + x) * 4 + 3] > 60) { top = y; break; }
      return Math.round(((wc.height - top) / wc.height) * 100);
    })(),
  };
};

function check(size, state, a, pinned) {
  if (!a.recordInk) fail(size, `${state}: record canvas is empty`);
  if (!a.wordInk) fail(size, `${state}: word canvas is empty`);
  if (pinned && !a.wordInside) fail(size, `${state}: word outside viewport ${JSON.stringify(a.wordBox)}`);
  if (a.stickerHits) fail(size, `${state}: ${a.stickerHits} sticker(s) overlap text`);
  if (pinned && (a.backOverflow || a.panelPastBack)) fail(size, `${state}: panel overflows by ${a.backOverflow || a.panelPastBack}px`);
  if (a.wrapped || a.tallRows) fail(size, `${state}: ${a.wrapped + a.tallRows} tracklist row(s) wrapped`);
  if (a.sentences > 3) fail(size, `${state}: ${a.sentences} sentences in the brief`);
}

for (const size of SIZES) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.scale,
    hasTouch: size.touch,
    isMobile: size.touch,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => problems.push(`[${size.name}] ${e}`));
  await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  const pinned = await page.evaluate(
    () => getComputedStyle(document.querySelector("[data-turntable] .stage")).position === "sticky",
  );
  note(size.name, pinned ? "pinned layout" : "stacked layout");

  const home = await page.evaluate(audit);
  check(size.name, "home", home, pinned);
  note(size.name, `home (AG RECORDS): letter width ${home.width}x natural, word ${home.squeeze}% of box height`);
  await page.screenshot({ path: `${OUT}/fix-${size.name}-home.png` });

  const tabs = await page.locator('[data-turntable] [role="tab"]').count();
  for (let i = 1; i < tabs; i++) {
    await page.locator('[data-turntable] [role="tab"]').nth(i).click();
    await page.waitForTimeout(1500);
    const state = await page.evaluate(audit);
    check(size.name, state.selected, state, pinned);
    note(size.name, `${state.selected}: letter width ${state.width}x natural, word ${state.squeeze}% of box height`);
    if (i === 1) {
      if (pinned) await page.screenshot({ path: `${OUT}/fix-${size.name}-tripwire.png` });
      else {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}/fix-${size.name}-tripwire.png` });
      }
    } else {
      await page.screenshot({ path: `${OUT}/fix-${size.name}-${state.selected}.png` });
    }
  }
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  await context.addInitScript(() => {
    let hidden = true;
    Object.defineProperty(document, "hidden", { get: () => hidden });
    Object.defineProperty(document, "visibilityState", { get: () => (hidden ? "hidden" : "visible") });
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => (hidden ? 0 : raf(cb));
    window.__reveal = () => {
      hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
    };
  });
  const page = await context.newPage();
  await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const ink = () =>
    page.evaluate(() => {
      const c = document.querySelector("[data-turntable] .deck canvas");
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 40) n++;
      return n;
    });
  const hiddenInk = await ink();
  if (!hiddenInk) fail("background tab", "record not drawn while the tab is hidden and frames are blocked");
  else note("background tab", `record drawn while hidden, no frames, no scroll (${hiddenInk} sampled pixels)`);
  await page.evaluate(() => window.__reveal());
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(1200);
  const after = await page.evaluate(
    () => document.querySelector('[role="tab"][aria-selected="true"] .nm')?.textContent?.trim(),
  );
  note("background tab", `after reveal and scroll: ${after}`);
  await context.close();
}

await browser.close();
console.log(problems.length ? `\n${problems.length} PROBLEM(S)\n${problems.join("\n")}` : "\nall checks pass");
