type Band = {
  title: string;
  catalog: string;
  seed: string;
  when: string;
  bars: number[];
};

type Geometry = {
  w: number;
  h: number;
  dpr: number;
  R: number;
  cx: number;
  cy: number;
  px: number;
  py: number;
  arm: number;
};

const LABEL = 0.33;
const GROOVE_IN = 0.4;
const GROOVE_OUT = 0.955;
const GAP = 0.02;
const REST = 1.14;
const BASE_SPEED = 0.55;
const MAX_SPEED = 7;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample(bars: number[], t: number): number {
  if (bars.length === 0) return 0;
  const x = clamp(t, 0, 1) * (bars.length - 1);
  const i = Math.floor(x);
  const j = Math.min(bars.length - 1, i + 1);
  return lerp(bars[i], bars[j], x - i);
}

export function mount(root: HTMLElement): void {
  const canvas = root.querySelector("canvas");
  const deck = canvas?.parentElement;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !deck || !ctx) return;

  const bands: Band[] = JSON.parse(root.dataset.bands ?? "[]");
  const lead = Number(root.dataset.lead ?? 0.6);
  const seg = Number(root.dataset.seg ?? 0.75);
  const count = bands.length;
  const total = lead + count * seg;

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'));

  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const colors = {
    paper: token("--ground"),
    hair: token("--hairline"),
    ink: token("--text"),
    soft: token("--text-soft"),
    dim: token("--text-dim"),
    mid: token("--grey-mid"),
    accent: token("--accent"),
  };
  const fonts = {
    display: token("--font-display"),
    caps: token("--font-caps"),
    mono: token("--font-mono"),
    weight: token("--display-weight") || "400",
  };

  const word = root.querySelector<HTMLCanvasElement>("[data-word]");
  const catalogs = Array.from(root.querySelectorAll<HTMLElement>("[data-catalog]"));
  const tag = root.querySelector<HTMLElement>("[data-tag]");
  const home = {
    word: root.dataset.homeWord ?? "",
    catalog: root.dataset.homeCatalog ?? "",
    tag: root.dataset.homeTag ?? "",
  };

  const stacked = window.matchMedia("(max-width: 49.99rem), (max-aspect-ratio: 1/1)");
  const wide = {
    get matches() {
      return !stacked.matches;
    },
  };
  const width = (GROOVE_OUT - GROOVE_IN - GAP * (count - 1)) / count;
  const outerOf = (i: number) => GROOVE_OUT - i * (width + GAP);
  const innerOf = (i: number) => outerOf(i) - width;

  let geo: Geometry | null = null;
  let disc: HTMLCanvasElement | null = null;
  let bright: HTMLCanvasElement | null = null;
  let labelArt: HTMLCanvasElement | null = null;
  let under: HTMLCanvasElement | null = null;
  let sheen: CanvasGradient | null = null;
  let labelFor = -2;
  let stale = true;

  let angle = 0;
  let omega = 0;
  let radius = REST;
  let target = REST;
  let index = -1;
  let tapped = -1;
  let lastScroll = window.scrollY;
  let velocity = 0;
  let visible = false;
  let frame = 0;
  let previous = 0;

  function progress(): number {
    const rect = root.getBoundingClientRect();
    const span = rect.height - window.innerHeight;
    if (span <= 0) return 0;
    return clamp(-rect.top / span, 0, 1);
  }

  function radiusAt(p: number): number {
    const s = p * total;
    if (s <= lead) return lerp(REST, GROOVE_OUT, smooth(s / lead));
    const t = (s - lead) / seg;
    const i = Math.min(count - 1, Math.floor(t));
    const next = i < count - 1 ? outerOf(i + 1) : GROOVE_IN;
    return lerp(outerOf(i), next, clamp(t - i, 0, 1));
  }

  function indexAt(p: number): number {
    const s = p * total;
    if (s < lead) return -1;
    return Math.min(count - 1, Math.floor((s - lead) / seg));
  }

  function measure(): Geometry {
    const rect = deck!.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const R = Math.min(h * 0.44, w / 2.36);
    const cx = (w - 2.3 * R) / 2 + R;
    const cy = h / 2;
    return { w, h, dpr, R, cx, cy, px: cx + 1.06 * R, py: cy - 0.62 * R, arm: R };
  }

  function grooves(g: CanvasRenderingContext2D, Rd: number, dpr: number, lit: boolean): void {
    g.lineWidth = dpr * (lit ? 1 : 0.9);
    g.strokeStyle = lit ? colors.paper : colors.mid;
    for (let i = 0; i < count; i++) {
      const outer = outerOf(i) * Rd;
      const inner = innerOf(i) * Rd;
      const lines = Math.max(6, Math.floor((outer - inner) / (2.3 * dpr)));
      const random = rng(hash(bands[i].seed));
      for (let j = 0; j < lines; j++) {
        const r0 = outer - ((j + 0.5) * (outer - inner)) / lines;
        const level = sample(bands[i].bars, lines > 1 ? j / (lines - 1) : 0);
        const amp = (0.1 + 1.25 * level) * dpr;
        const f1 = 14 + Math.floor(random() * 40);
        const f2 = 30 + Math.floor(random() * 60);
        const p1 = random() * Math.PI * 2;
        const p2 = random() * Math.PI * 2;
        const steps = Math.max(120, Math.floor((Math.PI * 2 * r0) / (2.5 * dpr)));
        g.globalAlpha = lit ? 0.5 + 0.45 * level : 0.2 + 0.32 * level;
        g.beginPath();
        for (let k = 0; k <= steps; k++) {
          const a = (k / steps) * Math.PI * 2;
          const r = r0 + amp * (0.6 * Math.sin(f1 * a + p1) + 0.4 * Math.sin(f2 * a + p2));
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (k === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.closePath();
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  function ring(g: CanvasRenderingContext2D, r: number, alpha: number, dpr: number): void {
    g.globalAlpha = alpha;
    g.lineWidth = dpr;
    g.strokeStyle = colors.mid;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }

  function arcText(
    g: CanvasRenderingContext2D,
    text: string,
    r: number,
    size: number,
    start: number,
  ): void {
    g.font = `600 ${size}px ${fonts.caps}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    let a = start;
    for (const ch of text) {
      const step = (g.measureText(ch).width + size * 0.28) / r;
      a += step / 2;
      g.save();
      g.rotate(a);
      g.translate(0, -r);
      g.fillText(ch, 0, 0);
      g.restore();
      a += step / 2;
    }
  }

  function prerender(): void {
    geo = measure();
    const { w, h, dpr, R } = geo;
    canvas!.width = Math.round(w * dpr);
    canvas!.height = Math.round(h * dpr);

    const Rd = R * dpr;
    const size = Math.ceil(Rd * 2) + 2;

    disc = document.createElement("canvas");
    disc.width = disc.height = size;
    const d = disc.getContext("2d")!;
    d.translate(size / 2, size / 2);
    const body = d.createRadialGradient(-Rd * 0.36, -Rd * 0.44, 0, 0, 0, Rd * 1.4);
    body.addColorStop(0, "#2b2b2a");
    body.addColorStop(0.5, "#141414");
    body.addColorStop(1, "#0c0c0c");
    d.fillStyle = body;
    d.beginPath();
    d.arc(0, 0, Rd, 0, Math.PI * 2);
    d.fill();
    ring(d, Rd * 0.995, 0.25, dpr);
    ring(d, Rd * 0.975, 0.07, dpr);
    for (let i = 0; i < count - 1; i++) ring(d, (innerOf(i) - GAP / 2) * Rd, 0.07, dpr);
    ring(d, Rd * 0.385, 0.08, dpr);
    ring(d, Rd * 0.372, 0.05, dpr);
    grooves(d, Rd, dpr, false);
    d.fillStyle = colors.mid;
    d.globalAlpha = 0.6;
    arcText(d, "AG RECORDS  MASTERED BY A GIRI  SIDE A", Rd * 0.352, Rd * 0.014, -0.9);
    d.globalAlpha = 1;

    bright = document.createElement("canvas");
    bright.width = bright.height = size;
    const b = bright.getContext("2d")!;
    b.translate(size / 2, size / 2);
    grooves(b, Rd, dpr, true);

    under = document.createElement("canvas");
    under.width = canvas!.width;
    under.height = canvas!.height;
    const u = under.getContext("2d")!;
    u.scale(dpr, dpr);
    u.save();
    u.shadowColor = "rgb(0 0 0 / 0.28)";
    u.shadowBlur = R * 0.16;
    u.shadowOffsetX = R * 0.02;
    u.shadowOffsetY = R * 0.06;
    u.fillStyle = colors.hair;
    u.beginPath();
    u.arc(geo.cx, geo.cy, R * 1.035, 0, Math.PI * 2);
    u.fill();
    u.restore();
    u.strokeStyle = colors.mid;
    u.lineWidth = 1;
    u.beginPath();
    u.arc(geo.cx, geo.cy, R * 1.035, 0, Math.PI * 2);
    u.stroke();
    u.save();
    u.shadowColor = "rgb(0 0 0 / 0.5)";
    u.shadowBlur = R * 0.06;
    u.shadowOffsetY = R * 0.02;
    u.fillStyle = "#0c0c0c";
    u.beginPath();
    u.arc(geo.cx, geo.cy, R * 0.99, 0, Math.PI * 2);
    u.fill();
    u.restore();

    sheen = null;
    if (typeof ctx!.createConicGradient === "function") {
      sheen = ctx!.createConicGradient(-0.6, 0, 0);
      sheen.addColorStop(0, "rgb(255 255 255 / 0)");
      sheen.addColorStop(0.06, "rgb(255 255 255 / 0.16)");
      sheen.addColorStop(0.14, "rgb(255 255 255 / 0)");
      sheen.addColorStop(0.5, "rgb(255 255 255 / 0)");
      sheen.addColorStop(0.56, "rgb(255 255 255 / 0.1)");
      sheen.addColorStop(0.64, "rgb(255 255 255 / 0)");
      sheen.addColorStop(1, "rgb(255 255 255 / 0)");
    }

    labelFor = -2;
    renderLabel();
    stale = true;
  }

  function renderLabel(): void {
    if (!geo) return;
    const lr = LABEL * geo.R * geo.dpr;
    const size = Math.ceil(lr * 2) + 2;
    labelArt = document.createElement("canvas");
    labelArt.width = labelArt.height = size;
    const g = labelArt.getContext("2d")!;
    g.translate(size / 2, size / 2);

    g.fillStyle = colors.paper;
    g.beginPath();
    g.arc(0, 0, lr, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = colors.ink;
    g.globalAlpha = 0.8;
    g.lineWidth = geo.dpr * 1.25;
    g.beginPath();
    g.arc(0, 0, lr * 0.93, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;

    g.fillStyle = colors.ink;
    g.textAlign = "center";
    g.textBaseline = "middle";

    const spaced = g as CanvasRenderingContext2D & { letterSpacing?: string };
    spaced.letterSpacing = `${lr * 0.03}px`;
    g.font = `600 ${lr * 0.1}px ${fonts.caps}`;
    g.fillText("AG RECORDS", lr * 0.015, -lr * 0.5);

    spaced.letterSpacing = "0px";
    g.font = `${fonts.weight} 100px ${fonts.display}`;
    const fitted = (100 * lr * 1.5) / Math.max(1, g.measureText("ANIKA GIRI").width);
    g.font = `${fonts.weight} ${fitted}px ${fonts.display}`;
    g.fillText("ANIKA GIRI", 0, lr * 0.4);

    spaced.letterSpacing = `${lr * 0.02}px`;
    g.font = `500 ${lr * 0.085}px ${fonts.mono}`;
    const line = index < 0 ? "SIDE A  33 RPM" : `${bands[index].catalog}  SIDE A`;
    g.fillText(line, lr * 0.01, lr * 0.68);

    labelFor = index;
    stale = true;
  }

  function drawArm(g: Geometry): void {
    const { R, cx, cy, px, py, arm } = g;
    const d = Math.hypot(cx - px, cy - py);
    const r = radius * R;
    const cosine = clamp((d * d + arm * arm - r * r) / (2 * d * arm), -1, 1);
    const phi = Math.atan2(cy - py, cx - px) - Math.acos(cosine);
    const ux = Math.cos(phi);
    const uy = Math.sin(phi);
    const sx = px + ux * arm;
    const sy = py + uy * arm;

    ctx!.save();
    ctx!.lineCap = "round";
    ctx!.shadowColor = "rgb(0 0 0 / 0.38)";
    ctx!.shadowBlur = R * 0.05;
    ctx!.shadowOffsetX = R * 0.02;
    ctx!.shadowOffsetY = R * 0.05;

    ctx!.fillStyle = colors.soft;
    ctx!.beginPath();
    ctx!.arc(px, py, R * 0.1, 0, Math.PI * 2);
    ctx!.fill();

    ctx!.strokeStyle = colors.soft;
    ctx!.lineWidth = R * 0.07;
    ctx!.lineCap = "butt";
    ctx!.beginPath();
    ctx!.moveTo(px - ux * R * 0.1, py - uy * R * 0.1);
    ctx!.lineTo(px - ux * R * 0.25, py - uy * R * 0.25);
    ctx!.stroke();

    ctx!.strokeStyle = colors.mid;
    ctx!.lineWidth = R * 0.022;
    ctx!.lineCap = "round";
    ctx!.beginPath();
    ctx!.moveTo(px - ux * R * 0.1, py - uy * R * 0.1);
    ctx!.lineTo(sx - ux * R * 0.06, sy - uy * R * 0.06);
    ctx!.stroke();

    ctx!.translate(sx, sy);
    ctx!.rotate(phi);
    ctx!.fillStyle = colors.ink;
    ctx!.fillRect(-R * 0.1, -R * 0.026, R * 0.11, R * 0.052);
    ctx!.strokeStyle = colors.soft;
    ctx!.lineWidth = R * 0.008;
    ctx!.beginPath();
    ctx!.moveTo(-R * 0.03, R * 0.026);
    ctx!.lineTo(R * 0.01, R * 0.075);
    ctx!.stroke();
    ctx!.restore();

    ctx!.fillStyle = colors.hair;
    ctx!.beginPath();
    ctx!.arc(px, py, R * 0.04, 0, Math.PI * 2);
    ctx!.fill();

    const dot = Math.max(4, R * 0.024);
    ctx!.fillStyle = colors.paper;
    ctx!.beginPath();
    ctx!.arc(sx, sy, dot * 1.45, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.fillStyle = colors.accent;
    ctx!.beginPath();
    ctx!.arc(sx, sy, dot, 0, Math.PI * 2);
    ctx!.fill();
  }

  function draw(): boolean {
    if (!geo || !disc || !bright || !labelArt || !under) return false;
    const { dpr, R, cx, cy } = geo;
    ctx!.setTransform(1, 0, 0, 1, 0, 0);
    ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx!.drawImage(under, 0, 0);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx!.save();
    ctx!.translate(cx, cy);
    ctx!.save();
    ctx!.rotate(angle);
    ctx!.drawImage(disc, -R, -R, R * 2, R * 2);
    ctx!.restore();

    if (index >= 0) {
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(0, 0, outerOf(index) * R + 1, 0, Math.PI * 2);
      ctx!.arc(0, 0, innerOf(index) * R - 1, 0, Math.PI * 2, true);
      ctx!.clip();
      ctx!.rotate(angle);
      ctx!.drawImage(bright, -R, -R, R * 2, R * 2);
      ctx!.restore();
    }

    const lr = LABEL * R;
    ctx!.save();
    ctx!.rotate(angle);
    ctx!.drawImage(labelArt, -lr, -lr, lr * 2, lr * 2);
    ctx!.restore();

    ctx!.fillStyle = colors.mid;
    ctx!.beginPath();
    ctx!.arc(0, 0, lr * 0.075, 0, Math.PI * 2);
    ctx!.fill();

    if (sheen) {
      ctx!.fillStyle = sheen;
      ctx!.beginPath();
      ctx!.arc(0, 0, R, 0, Math.PI * 2);
      ctx!.arc(0, 0, lr, 0, Math.PI * 2, true);
      ctx!.fill();
    }
    ctx!.restore();

    drawArm(geo);
    return true;
  }

  let speck: HTMLCanvasElement | null = null;

  function speckle(): HTMLCanvasElement {
    if (speck) return speck;
    speck = document.createElement("canvas");
    speck.width = speck.height = 192;
    const g = speck.getContext("2d")!;
    const random = rng(77);
    g.fillStyle = colors.paper;
    for (let i = 0; i < 1500; i++) {
      g.globalAlpha = 0.35 + random() * 0.6;
      const s = random() < 0.85 ? 1 : 2;
      g.fillRect(Math.floor(random() * 192), Math.floor(random() * 192), s, s);
    }
    return speck;
  }

  function drawWord(): void {
    if (!word) return;
    const spec = `${fonts.weight} 200px ${fonts.display}`;
    if (document.fonts && !document.fonts.check(spec)) return;
    const box = word.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(box.width * dpr);
    const H = Math.round(box.height * dpr);
    word.width = W;
    word.height = H;
    const g = word.getContext("2d")!;
    const band = index >= 0 ? bands[index] : null;
    const text = (band ? band.title : home.word).toUpperCase();

    g.font = spec;
    const m = g.measureText(text);
    const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (inkW < 1 || inkH < 1) return;
    g.save();
    g.scale(W / inkW, H / inkH);
    g.fillStyle = colors.ink;
    g.textBaseline = "alphabetic";
    g.fillText(text, m.actualBoundingBoxLeft, m.actualBoundingBoxAscent);
    g.restore();

    g.globalCompositeOperation = "source-atop";
    const pattern = g.createPattern(speckle(), "repeat");
    if (pattern) {
      g.fillStyle = pattern;
      g.fillRect(0, 0, W, H);
    }
    const random = rng(hash(text));
    for (let i = 0; i < 7; i++) {
      const x = random() * W;
      const y = random() * H;
      const r = H * (0.5 + random() * 0.9);
      const wear = g.createRadialGradient(x, y, 0, x, y, r);
      wear.addColorStop(0, "rgb(236 236 234 / 0.2)");
      wear.addColorStop(1, "rgb(236 236 234 / 0)");
      g.fillStyle = wear;
      g.fillRect(0, 0, W, H);
    }
    g.globalCompositeOperation = "source-over";
  }

  function describe(): void {
    const band = index >= 0 ? bands[index] : null;
    catalogs.forEach((el) => {
      el.textContent = band ? band.catalog : home.catalog;
    });
    if (tag) tag.textContent = band ? band.when : home.tag;
    if (word) {
      drawWord();
      word.classList.remove("swap");
      void word.offsetWidth;
      word.classList.add("swap");
    }
  }

  function reflect(): void {
    describe();
    const slot = index + 1;
    tabs.forEach((tab, i) => {
      const on = i === slot;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach((panel, i) => {
      panel.hidden = i !== slot;
    });
    if (tabs.some((tab) => tab === document.activeElement)) tabs[slot]?.focus({ preventScroll: true });
  }

  function select(next: number): void {
    const to = clamp(next, -1, count - 1);
    if (wide.matches) {
      const rect = root.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = to < 0 ? 0 : (lead + to * seg + seg * 0.12) / total;
      window.scrollTo({ top: window.scrollY + rect.top + p * span, behavior: "smooth" });
    } else {
      tapped = to;
    }
  }

  function tick(now: number): void {
    frame = 0;
    if (!visible) return;
    const dt = clamp((now - previous) / 1000, 0, 0.05);
    previous = now;

    let next = index;
    if (wide.matches) {
      const p = progress();
      target = radiusAt(p);
      next = indexAt(p);
      const y = window.scrollY;
      const instant = dt > 0 ? (y - lastScroll) / dt : 0;
      lastScroll = y;
      velocity = lerp(velocity, instant, 1 - Math.exp(-dt * 12));
    } else {
      next = tapped;
      target = tapped < 0 ? REST : outerOf(tapped) - width * 0.18;
      velocity = lerp(velocity, 0, 1 - Math.exp(-dt * 12));
    }

    radius = lerp(radius, target, 1 - Math.exp(-dt * 9));

    const playing = next >= 0 ? BASE_SPEED : 0;
    const goal = clamp(playing + velocity * 0.0016, -MAX_SPEED, MAX_SPEED);
    omega = lerp(omega, goal, 1 - Math.exp(-dt * 1.6));
    angle = (angle + omega * dt) % (Math.PI * 2);

    if (next !== index) {
      index = next;
      reflect();
    }
    if (labelFor !== index) renderLabel();

    const moving = Math.abs(omega) > 0.0004 || Math.abs(radius - target) > 0.0003;
    if (moving || stale) {
      if (draw()) stale = false;
    }
    frame = requestAnimationFrame(tick);
  }

  function start(): void {
    if (frame || !visible) return;
    previous = performance.now();
    lastScroll = window.scrollY;
    frame = requestAnimationFrame(tick);
  }

  function hit(event: PointerEvent): number | null {
    if (!geo) return null;
    const rect = canvas!.getBoundingClientRect();
    const r = Math.hypot(event.clientX - rect.left - geo.cx, event.clientY - rect.top - geo.cy) / geo.R;
    for (let i = 0; i < count; i++) {
      if (r <= outerOf(i) + GAP / 2 && r >= innerOf(i) - GAP / 2) return i;
    }
    return null;
  }

  canvas.addEventListener("click", (event) => {
    const i = hit(event as PointerEvent);
    if (i !== null) select(i);
  });

  canvas.addEventListener("pointermove", (event) => {
    canvas.style.cursor = hit(event) === null ? "default" : "pointer";
  });

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(i - 1));
    tab.addEventListener("keydown", (event) => {
      const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
      const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
      if (!forward && !back && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      event.stopPropagation();
      const to = event.key === "Home" ? -1 : event.key === "End" ? count - 1 : index + (forward ? 1 : -1);
      const slot = clamp(to, -1, count - 1) + 1;
      tabs[slot]?.focus({ preventScroll: true });
      select(to);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (!visible || event.defaultPrevented) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const el = event.target as HTMLElement | null;
    if (el && /^(INPUT|TEXTAREA|SELECT|VIDEO)$/.test(el.tagName)) return;
    event.preventDefault();
    select(index + (event.key === "ArrowRight" ? 1 : -1));
  });

  new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting) && !document.hidden;
    start();
  }).observe(root);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) visible = false;
    else {
      const rect = root.getBoundingClientRect();
      visible = rect.bottom > 0 && rect.top < window.innerHeight;
      start();
    }
  });

  let pending = 0;
  new ResizeObserver(() => {
    window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      prerender();
      drawWord();
      draw();
    }, 80);
  }).observe(deck);

  stacked.addEventListener("change", () => {
    tapped = index;
  });

  window.addEventListener("pageshow", () => {
    const rect = root.getBoundingClientRect();
    visible = !document.hidden && rect.bottom > 0 && rect.top < window.innerHeight;
    stale = true;
    start();
  });

  const faces = document.fonts
    ? Promise.all([
        document.fonts.load(`${fonts.weight} 24px ${fonts.display}`),
        document.fonts.load(`600 12px ${fonts.caps}`),
        document.fonts.load(`500 12px ${fonts.mono}`),
      ]).catch(() => [])
    : Promise.resolve([]);
  prerender();
  reflect();
  draw();
  start();

  faces.then(() => {
    prerender();
    drawWord();
    draw();
    start();
  });
}
