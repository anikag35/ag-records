#!/usr/bin/env node
import { mkdir, rename, readdir, rm } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4321/ag-records";
const PATH = process.argv[2] ?? "/lab";
const OUT = ".shots";
const VIDEO = `${OUT}/video`;

await mkdir(OUT, { recursive: true });
await rm(VIDEO, { recursive: true, force: true });

const browser = await chromium.launch();
const errors = [];

async function scrollTo(page, fraction) {
  await page.evaluate((f) => {
    const root = document.querySelector("[data-turntable]");
    const rect = root.getBoundingClientRect();
    const span = rect.height - window.innerHeight;
    window.scrollTo({ top: window.scrollY + rect.top + f * span, behavior: "instant" });
  }, fraction);
  await page.waitForTimeout(900);
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
    recordVideo: { dir: VIDEO, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/lab-desktop-1-sleeve.png` });

  await page.mouse.move(700, 450);
  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        const step = () => {
          frames++;
          if (performance.now() - start < 2000) requestAnimationFrame(step);
          else resolve(Math.round((frames * 1000) / (performance.now() - start)));
        };
        requestAnimationFrame(step);
      }),
  );
  console.log(`idle rAF rate: ${fps} fps`);

  const total = await page.evaluate(() => {
    const root = document.querySelector("[data-turntable]");
    return root.getBoundingClientRect().height - window.innerHeight;
  });
  const steps = 150;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, total / steps);
    await page.waitForTimeout(34);
  }
  await page.waitForTimeout(700);
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, -(total * 0.4) / 40);
    await page.waitForTimeout(34);
  }
  await page.waitForTimeout(900);

  await scrollTo(page, 0.34);
  await page.screenshot({ path: `${OUT}/lab-desktop-2-band2.png` });
  await scrollTo(page, 0.86);
  await page.screenshot({ path: `${OUT}/lab-desktop-3-band5.png` });

  await scrollTo(page, 0);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1200);
  const viaKey = await page.evaluate(
    () => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(),
  );
  console.log(`after ArrowRight from sleeve: ${viaKey}`);

  await context.close();
  const files = await readdir(VIDEO);
  if (files[0]) await rename(`${VIDEO}/${files[0]}`, `${OUT}/lab-scrub.webm`);
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/lab-mobile-1-sleeve.png` });

  const box = await page.locator("[data-turntable] canvas").boundingBox();
  const R = Math.min(box.height * 0.46, box.width / 2.36);
  const cx = (box.width - 2.3 * R) / 2 + R;
  const cy = box.height / 2;
  await page.touchscreen.tap(box.x + cx - R * 0.69, box.y + cy);
  await page.waitForTimeout(1400);
  const tapped = await page.evaluate(
    () => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(),
  );
  console.log(`after tapping the third band: ${tapped}`);
  await page.screenshot({ path: `${OUT}/lab-mobile-2-band.png` });
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
    fallbackVisible: getComputedStyle(document.querySelector(".static-fallback")).display !== "none",
  }));
  console.log(`reduced motion: ${JSON.stringify(state)}`);
  await context.close();
}

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
