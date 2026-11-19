#!/usr/bin/env node
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4321/ag-records";
const PATH = process.argv[2] ?? "/lab";
const OUT = ".shots";
const problems = [];
const say = (tag, text) => console.log(`[${tag}] ${text}`);
const fail = (tag, text) => {
  problems.push(`[${tag}] ${text}`);
  console.log(`[${tag}] FAIL ${text}`);
};

const audit = () => {
  const crates = [...document.querySelectorAll("[data-crate]")];
  return crates.map((crate) => {
    const sleeves = [...crate.querySelectorAll("[data-sleeve]")];
    const front = sleeves.find((s) => s.hasAttribute("data-front")) ?? sleeves[0];
    const lip = crate.querySelector(".lip");
    const lipTop = lip && getComputedStyle(lip).display !== "none" ? lip.getBoundingClientRect().top : Infinity;
    const kids = [...front.children].filter((c) => c.offsetParent !== null && !c.classList.contains("sr"));
    const lastBottom = Math.max(...kids.map((c) => c.getBoundingClientRect().bottom));
    return {
      name: crate.getAttribute("aria-label"),
      count: crate.querySelector("[data-count]")?.textContent?.trim(),
      overflow: sleeves.filter((s) => s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1).length,
      wider: sleeves.filter((s) => s.getBoundingClientRect().width > crate.getBoundingClientRect().width + 1).length,
      underLip: Math.max(0, Math.round(lastBottom - lipTop)),
      frontOpacity: getComputedStyle(front).opacity,
    };
  });
};

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

for (const size of [
  { name: "1440x900", width: 1440, height: 900, scale: 1, touch: false },
  { name: "800x600", width: 800, height: 600, scale: 1, touch: false },
  { name: "mobile", width: 390, height: 844, scale: 2, touch: true },
]) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.scale,
    hasTouch: size.touch,
    isMobile: size.touch,
    reducedMotion: "no-preference",
    ...(size.name === "1440x900"
      ? { recordVideo: { dir: `${OUT}/video`, size: { width: 1440, height: 900 } } }
      : {}),
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => fail(size.name, String(e)));
  await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const section = page.locator(".catalogue");
  await section.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -40));
  await page.waitForTimeout(2200);

  const wide = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  if (wide[0] > size.width || wide[1] > size.width) fail(size.name, `page is ${wide[0]}px wide on a ${size.width}px screen`);
  const settled = await page.evaluate(() => document.querySelector("[data-crates-row]").classList.contains("settled"));
  if (!settled) fail(size.name, "entrance never settled");
  const rest = await page.evaluate(audit);
  if (rest.length !== 3) fail(size.name, `expected 3 crates, found ${rest.length}`);
  for (const c of rest) {
    if (c.overflow) fail(size.name, `${c.name}: ${c.overflow} sleeve(s) overflow`);
    if (c.wider) fail(size.name, `${c.name}: ${c.wider} sleeve(s) wider than the crate`);
    if (c.underLip) fail(size.name, `${c.name}: front sleeve text runs ${c.underLip}px under the crate lip`);
    if (c.frontOpacity !== "1") fail(size.name, `${c.name}: front sleeve not visible`);
  }
  await section.screenshot({ path: `${OUT}/crates-${size.name}.png` });

  const crates = page.locator("[data-crate]");
  for (let i = 0; i < 3; i++) {
    const crate = crates.nth(i);
    if (size.touch) await crate.scrollIntoViewIfNeeded();
    await crate.locator("[data-next]").click();
    await page.waitForTimeout(750);
  }
  const flipped = await page.evaluate(audit);
  for (const c of flipped) {
    if (!c.count?.startsWith("2 of")) fail(size.name, `${c.name}: after Flip the count reads "${c.count}"`);
    if (c.underLip) fail(size.name, `${c.name}: flipped sleeve text runs ${c.underLip}px under the lip`);
  }
  say(size.name, `after one flip: ${flipped.map((c) => `${c.name.split(" ")[0]} ${c.count}`).join(", ")}`);
  if (!size.touch) await section.screenshot({ path: `${OUT}/crates-${size.name}-flipped.png` });

  if (!size.touch) {
    for (let k = 0; k < 2; k++) {
      await crates.nth(0).locator("[data-sleeve][data-front]").click();
      await page.waitForTimeout(700);
    }
    await crates.nth(0).locator("[data-prev]").click();
    await page.waitForTimeout(800);
    await crates.nth(0).locator("[data-next]").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(800);
    const aws = (await page.evaluate(audit))[0];
    say(size.name, `AWS after 2 sleeve clicks, Back, ArrowRight: ${aws.count}`);
    if (aws.count !== "4 of 4") fail(size.name, `AWS expected "4 of 4", got "${aws.count}"`);
  }
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
  await page.locator(".catalogue").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator("[data-crate]").nth(1).locator("[data-next]").click();
  await page.waitForTimeout(150);
  const c = (await page.evaluate(audit))[1];
  say("reduced motion", `stacked, Sky Lab after Flip: ${c.count}, visible ${c.frontOpacity}`);
  if (c.count !== "2 of 3" || c.frontOpacity !== "1") fail("reduced motion", "flip did not work instantly");
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
  const state = await page.evaluate(() => {
    const sleeves = [...document.querySelectorAll("[data-sleeve]")];
    const rects = sleeves.map((s) => s.getBoundingClientRect());
    let overlaps = 0;
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps++;
      }
    return { sleeves: sleeves.length, overlaps, controls: getComputedStyle(document.querySelector(".controls")).display };
  });
  say("no JS", `${state.sleeves} sleeves laid out, ${state.overlaps} overlapping, controls ${state.controls}`);
  if (state.overlaps || state.controls !== "none") fail("no JS", "fallback is not a plain readable list");
  await page.locator(".catalogue").screenshot({ path: `${OUT}/crates-nojs.png` });
  await context.close();
}

await browser.close();
try {
  const files = await readdir(`${OUT}/video`);
  if (files[0]) await rename(`${OUT}/video/${files[0]}`, `${OUT}/crates-flip.webm`);
  await rm(`${OUT}/video`, { recursive: true, force: true });
} catch {}
console.log(problems.length ? `\n${problems.length} PROBLEM(S)\n${problems.join("\n")}` : "\nall checks pass");
