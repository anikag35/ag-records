#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4321/ag-records";
const OUT = process.env.OUT ?? ".shots";
const paths = process.argv.slice(2);
if (paths.length === 0) paths.push("/");

const viewports = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 },
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

for (const [label, viewport] of Object.entries(viewports)) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  for (const path of paths) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const name = path.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "home";
    const file = `${OUT}/${name}-${label}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await context.close();
}

await browser.close();
