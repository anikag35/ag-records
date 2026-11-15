#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4321/ag-records";
const PATH = process.argv[2] ?? "/lab";
const OUT = ".shots";

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const errors = [];

const selected = (page) =>
  page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"] .nm')?.textContent?.trim());

async function open(context) {
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return page;
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  const page = await open(context);
  await page.screenshot({ path: `${OUT}/lab-desktop-home.png` });

  await page.evaluate(() => {
    const root = document.querySelector("[data-turntable]");
    const rect = root.getBoundingClientRect();
    const span = rect.height - window.innerHeight;
    window.scrollTo({ top: window.scrollY + rect.top + 0.215 * span, behavior: "instant" });
  });
  await page.waitForTimeout(1400);
  console.log(`desktop, scrolled: ${await selected(page)}`);
  await page.screenshot({ path: `${OUT}/lab-desktop-tripwire.png` });

  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1300);
  console.log(`desktop, after ArrowRight: ${await selected(page)}`);
  const overflow = await page.evaluate(() => {
    const back = document.querySelector("[data-turntable] .back");
    return back.scrollHeight - back.clientHeight;
  });
  console.log(`sleeve panel overflow on the longest check: ${overflow}px`);
  await context.close();
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    reducedMotion: "no-preference",
  });
  const page = await open(context);
  await page.screenshot({ path: `${OUT}/lab-mobile-home.png` });

  const box = await page.locator("[data-turntable] canvas").boundingBox();
  const R = Math.min(box.height * 0.44, box.width / 2.36);
  const cx = (box.width - 2.3 * R) / 2 + R;
  await page.touchscreen.tap(box.x + cx - R * 0.91, box.y + box.height / 2);
  await page.waitForTimeout(1400);
  console.log(`mobile, tapped outer band: ${await selected(page)}`);
  await page.screenshot({ path: `${OUT}/lab-mobile-tripwire.png` });
  await page.screenshot({ path: `${OUT}/lab-mobile-tripwire-full.png`, fullPage: true });
  await context.close();
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
  const state = await page.evaluate(() => ({
    turntableHidden: document.querySelector("[data-turntable]").hidden,
    tracks: document.querySelectorAll(".static-fallback details").length,
  }));
  console.log(`reduced motion: ${JSON.stringify(state)}`);
  await context.close();
}

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
