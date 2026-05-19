#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync, spawnSync } = require("child_process");

const DEFAULT_DATA = path.resolve(__dirname, "data.json");
const DEFAULT_OUTPUT = path.resolve(__dirname, "dijital-performans-raporu.pdf");
const DEFAULT_HTML = path.resolve(__dirname, "dijital-performans-raporu.html");
const DEFAULT_TOP3_DIR = path.resolve(__dirname, "top3");
const DEFAULT_LOGO_DIR = path.resolve(__dirname, "logo");
const DEFAULT_SOCIAL_DIR = path.resolve(__dirname, "social-media");

const args = parseArgs(process.argv.slice(2));
const dataFile = path.resolve(args.data || DEFAULT_DATA);
const outputFile = path.resolve(args.output || DEFAULT_OUTPUT);
const htmlFile = path.resolve(args.html || DEFAULT_HTML);
const top3Dir = path.resolve(args.top3 || DEFAULT_TOP3_DIR);
const logoDir = path.resolve(args.logo || DEFAULT_LOGO_DIR);
const socialDir = path.resolve(args.social || DEFAULT_SOCIAL_DIR);
const title = args.title || "Dijital Performans Analizi";
const category = args.category || "BELEDİYELER (Pozitif Veriler)";
const dateRange = args.date || "11 Mayıs 2026 - 17 Mayıs 2026";
const totalInteractions = args.total || "30.051.307";
const methodText = formatArgText(args.method) || [
  "DİDEK (Dijital İzleme ve Değerleme Kurulu) tarafından belirlenen 39 gazeteci arasından ilk 10'da yer alanlar",
  "*Bu rapor, belirtilen tarih aralığında gerçekleşen 19.416.120 etkileşim verisinin analiziyle oluşturulmuştur."
].join("\n");

const rawData = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const rows = rawData
  .map((item) => ({
    name: String(item.name || "").trim(),
    percentage: Number(item.percentage)
  }))
  .filter((item) => item.name && Number.isFinite(item.percentage))
  .sort((a, b) => b.percentage - a.percentage)
  .slice(0, 10);

if (!rows.length) {
  throw new Error("Veri listesi boş veya geçersiz.");
}

const html = renderHtml({
  rows,
  title,
  category,
  dateRange,
  totalInteractions,
  methodText,
  top3Images: getTop3Images(top3Dir),
  logoImage: getLogoImage(logoDir),
  socialImages: getSocialImages(socialDir)
});

fs.writeFileSync(htmlFile, html, "utf8");

if (!args["html-only"]) {
  printPdf(htmlFile, outputFile);
}

console.log(args["html-only"] ? htmlFile : outputFile);

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "html-only") {
      result[key] = true;
    } else {
      result[key] = argv[i + 1];
      i += 1;
    }
  }
  return result;
}

function printPdf(inputHtml, outputPdf) {
  const chrome = findChrome();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "rapor-chrome-"));
  if (fs.existsSync(outputPdf)) fs.unlinkSync(outputPdf);

  const result = spawnSync(chrome, [
    "--headless",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-features=PaintHolding",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profileDir}`,
    "--allow-file-access-from-files",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=2000",
    "--print-to-pdf-no-header",
    `--print-to-pdf=${outputPdf}`,
    toFileUrl(inputHtml)
  ], {
    encoding: "utf8",
    timeout: 15000
  });

  if (fs.existsSync(outputPdf) && fs.statSync(outputPdf).size > 0) return;

  const detail = [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n");
  throw new Error(`PDF oluşturulamadı.\n${detail}`);
}

function findChrome() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "google-chrome",
    "chromium",
    "chromium-browser"
  ];

  for (const candidate of candidates) {
    if (candidate.includes("/") && fs.existsSync(candidate)) return candidate;
    if (!candidate.includes("/")) {
      try {
        execFileSync("which", [candidate], { stdio: "ignore" });
        return candidate;
      } catch (_) {
        // Try the next executable name.
      }
    }
  }

  throw new Error("Chrome/Chromium bulunamadı. PDF için Google Chrome kurulu olmalı.");
}

function toFileUrl(filePath) {
  return `file://${filePath.split(path.sep).map(encodeURIComponent).join("/")}`;
}

function renderHtml({ rows, title, category, dateRange, totalInteractions, methodText, top3Images, logoImage, socialImages }) {
  const max = Math.max(15, Math.ceil(rows[0].percentage / 5) * 5);
  const top = rows.slice(0, 3);
  const cardOrder = [top[1], top[0], top[2]].filter(Boolean);
  const gridTicks = [0, 5, 10, 15, 20, 25];
  const legendNameSize = Math.min(...rows.map((item) => fitFontSizeToWidth(item.name, 300, 22, 13)));
  const topNameSize = Math.min(
    ...cardOrder.map((person) => {
      const rank = rows.indexOf(person) + 1;
      const nameWidth = rank === 1 ? 336 : 282;
      return fitFontSizeToWidth(person.name, nameWidth, 29, 14);
    })
  );
  const categorySize = fitFontSizeToWidth(category, 330, 26, 18);
  const dateSize = fitFontSizeToWidth(dateRange, 390, 26, 18);

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: 1080px 1580px; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #06111c;
      color: #f5f7fb;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      position: relative;
      width: 1080px;
      height: 1580px;
      overflow: hidden;
      padding: 28px 30px 20px;
      background:
        radial-gradient(circle at 86% 14%, rgba(27,111,207,.38) 0 1px, transparent 2px) 0 0 / 18px 18px,
        radial-gradient(circle at 58% 38%, rgba(14,83,151,.26), transparent 34%),
        linear-gradient(180deg, #07131f 0%, #03101a 58%, #03101a 100%);
    }
    .header {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 24px;
      align-items: start;
    }
    h1 {
      margin: 0;
      font-size: 52px;
      line-height: .98;
      letter-spacing: 0;
      font-weight: 800;
    }
    .blue { color: #1278ff; display: block; }
    .meta {
      margin-top: 14px;
      display: flex;
      align-items: center;
      gap: 18px;
      color: #f2f5fa;
      white-space: nowrap;
    }
    .category {
      color: #2386ff;
      font-weight: 800;
      font-size: var(--category-size, 26px);
      line-height: 1.12;
      white-space: nowrap;
    }
    .date-range {
      font-size: var(--date-size, 26px);
      line-height: 1.12;
      white-space: nowrap;
    }
    .divider {
      flex: 0 0 auto;
      width: 2px;
      height: 34px;
      background: rgba(255,255,255,.72);
    }
    .subtitle {
      margin-top: 10px;
      font-size: 23px;
      color: #e8edf5;
    }
    .brand {
      text-align: center;
      min-height: 142px;
      display: grid;
      place-items: center;
    }
    .brand img {
      max-width: 320px;
      max-height: 142px;
      object-fit: contain;
      display: block;
      filter: drop-shadow(0 8px 14px rgba(0,0,0,.28));
    }
    .brand-fallback {
      letter-spacing: 10px;
      font-size: 40px;
      font-weight: 600;
    }
    .brand-fallback small {
      display: block;
      margin-top: 4px;
      letter-spacing: 1px;
      font-size: 9px;
      font-weight: 700;
    }
    .cards {
      margin-top: 20px;
      display: grid;
      grid-template-columns: 1fr 1.18fr 1fr;
      gap: 16px;
      align-items: end;
    }
    .person-card {
      position: relative;
      height: 420px;
      border: 2px solid var(--accent);
      border-radius: 12px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(10,25,39,.7) 0%, rgba(3,15,26,.95) 72%, rgba(3,15,26,.98) 100%),
        #0b1723;
      box-shadow: inset 0 0 28px rgba(255,255,255,.04);
    }
    .person-card.rank-1 { height: 440px; }
    .rank {
      position: absolute;
      z-index: 3;
      left: 22px;
      top: 10px;
      color: var(--accent);
      font-size: 62px;
      line-height: 1;
      font-weight: 900;
    }
    .portrait {
      position: absolute;
      inset: 12px 16px 118px;
      display: flex;
      justify-content: center;
      align-items: end;
      overflow: hidden;
      border-radius: 6px;
      background: transparent;
    }
    .portrait img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
      border-radius: 6px;
    }
    .portrait .placeholder {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      color: rgba(255,255,255,.55);
      font-size: 92px;
      font-weight: 800;
      background: radial-gradient(circle, rgba(255,255,255,.28), rgba(255,255,255,.04) 60%);
    }
    .card-footer {
      position: absolute;
      left: 14px;
      right: 14px;
      bottom: 16px;
      text-align: center;
    }
    .name {
      font-size: var(--name-size, 29px);
      line-height: 1.1;
      font-weight: 800;
      white-space: nowrap;
      overflow: visible;
    }
    .shine {
      margin: 8px auto 9px;
      width: 82%;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      opacity: .72;
    }
    .percent {
      color: var(--accent);
      font-size: 50px;
      line-height: .92;
      font-weight: 900;
    }
    .panel {
      margin-top: 18px;
      border: 1px solid rgba(98,138,184,.36);
      border-radius: 10px;
      background: rgba(3,17,29,.68);
      box-shadow: inset 0 0 24px rgba(44,121,214,.08);
    }
    .chart {
      position: relative;
      display: grid;
      grid-template-columns: 350px 1fr;
      gap: 24px;
      padding: 32px 28px 46px 24px;
      height: 520px;
    }
    .chart-title {
      position: absolute;
      top: 12px;
      right: 28px;
      color: #e6edf7;
      font-size: 22px;
    }
    .legend-list {
      display: grid;
      gap: 8px;
      align-content: start;
      padding-top: 24px;
    }
    .legend-item {
      display: grid;
      grid-template-columns: 31px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      height: 31px;
      font-size: var(--legend-size, 22px);
    }
    .legend-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
      min-width: 0;
    }
    .badge {
      width: 31px;
      height: 31px;
      border: 1.5px solid var(--accent);
      border-radius: 8px;
      display: grid;
      place-items: center;
      color: #fff;
      background: var(--badge-bg);
      font-size: 18px;
      font-weight: 700;
    }
    .plot {
      position: relative;
      padding: 24px 0 36px;
    }
    .grid {
      position: absolute;
      inset: 0 0 36px 0;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      border-left: 2px solid rgba(255,255,255,.8);
    }
    .grid span {
      border-right: 1px dashed rgba(150,112,154,.65);
    }
    .bars {
      position: relative;
      z-index: 2;
      display: grid;
      gap: 8px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 1fr 88px;
      gap: 12px;
      align-items: center;
      height: 31px;
    }
    .bar-track {
      height: 23px;
      position: relative;
    }
    .bar {
      height: 100%;
      width: calc(var(--value) / ${max} * 100%);
      min-width: 18px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 80%, white 20%), var(--accent) 60%, color-mix(in srgb, var(--accent) 62%, black 38%));
      box-shadow: 0 3px 9px color-mix(in srgb, var(--accent) 38%, transparent);
    }
    .bar-value {
      color: #f9fbff;
      font-size: 22px;
      text-shadow: 0 2px 5px #000;
    }
    .axis {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      justify-content: space-between;
      color: #f1f4fa;
      font-size: 20px;
    }
    .sources {
      margin-top: 22px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0;
      padding: 18px 20px;
      height: 112px;
    }
    .source {
      display: grid;
      grid-template-columns: 62px 1fr;
      gap: 14px;
      align-items: center;
      padding: 0 18px;
      border-right: 1px solid rgba(255,255,255,.45);
    }
    .source:last-child { border-right: 0; }
    .source-title {
      font-size: 20px;
      margin-bottom: 5px;
    }
    .source-text {
      color: #dce4ef;
      font-size: 16px;
      line-height: 1.25;
    }
    .source-icon {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      border: 1px solid rgba(57,126,209,.5);
      background: radial-gradient(circle, rgba(20,96,180,.35), rgba(8,22,35,.7));
    }
    .source-icon svg {
      width: 35px;
      height: 35px;
      display: block;
      color: #e8f1ff;
      stroke-width: 1.8;
    }
    .social-icons {
      width: 62px;
      display: grid;
      grid-template-columns: repeat(2, 27px);
      gap: 7px;
      align-items: center;
      justify-content: center;
    }
    .social-icons img {
      width: 27px;
      height: 27px;
      object-fit: contain;
      border-radius: 50%;
      display: block;
      background: rgba(255,255,255,.08);
    }
    .method {
      display: grid;
      grid-template-columns: 260px 1fr;
      padding: 12px 20px;
      align-items: center;
      height: 94px;
    }
    .method-label {
      color: #2479d8;
      font-size: 17px;
      border-right: 1px solid rgba(255,255,255,.62);
      display: flex;
      gap: 14px;
      align-items: center;
      height: 64px;
    }
    .info {
      width: 42px;
      height: 42px;
      border: 3px solid rgba(255,255,255,.78);
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: #fff;
      font-weight: 900;
      font-size: 24px;
    }
    .method-text {
      padding-left: 24px;
      color: #d9e1ec;
      font-size: 17px;
      line-height: 1.16;
    }
    .method-text strong { color: #fff; font-weight: 800; }
  </style>
</head>
<body>
  <main class="page">
    <section class="header">
      <div>
        <h1>${escapeHtml(title).replace(" Analizi", "<span class=\"blue\">Analizi</span>")}</h1>
        <div class="meta" style="--category-size:${categorySize}px; --date-size:${dateSize}px;">
          <span class="category">${escapeHtml(category)}</span>
          <span class="divider"></span>
          <span class="date-range">${escapeHtml(dateRange)}</span>
        </div>
        <div class="subtitle">Sosyal medya, yazılı basın ve TV verilerinin birleşik analizi</div>
      </div>
      <div class="brand">${renderLogo(logoImage)}</div>
    </section>

    <section class="cards">
      ${cardOrder.map((person) => renderCard(person, rows.indexOf(person) + 1, top3Images, topNameSize)).join("")}
    </section>

    <section class="panel chart">
      <div class="chart-title">Pay Oranı (%)</div>
      <div class="legend-list">
        ${rows.map((item, index) => renderLegend(item, index, legendNameSize)).join("")}
      </div>
      <div class="plot">
        <div class="grid">${gridTicks.slice(1).map(() => "<span></span>").join("")}</div>
        <div class="bars">
          ${rows.map((item, index) => renderBar(item, index)).join("")}
        </div>
        <div class="axis">${gridTicks.map((tick) => `<span>${tick}%</span>`).join("")}</div>
      </div>
    </section>

    <section class="panel sources">
      <div class="source">
        ${renderSocialIcons(socialImages)}
        <div>
          <div class="source-title">Sosyal Medya</div>
          <div class="source-text">X, Instagram, Facebook,<br>YouTube, Linkedin</div>
        </div>
      </div>
      <div class="source">
        ${renderPressIcon()}
        <div>
          <div class="source-title">Yazılı Basın</div>
          <div class="source-text">Haberler, Köşe yazıları,<br>Gazeteler, Blog/Forum/Sözlük</div>
        </div>
      </div>
      <div class="source">
        ${renderTvIcon()}
        <div>
          <div class="source-title">TV</div>
          <div class="source-text">Ulusal TV kanalları ve<br>televizyon programları</div>
        </div>
      </div>
    </section>

    <section class="panel method">
      <div class="method-label"><span class="info">i</span><span>YÖNTEM VE KAPSAM</span></div>
      <div class="method-text">${renderMethodText(methodText, totalInteractions)}</div>
    </section>
  </main>
</body>
</html>`;
}

function renderCard(person, rank, top3Images, nameSize) {
  const theme = getTheme(rank);
  const image = top3Images[rank] || "";
  const isRankOne = rank === 1 ? " rank-1" : "";
  return `<article class="person-card${isRankOne}" style="--accent:${theme.accent}; --name-size:${nameSize}px;">
    <div class="rank">${rank}</div>
    <div class="portrait">${image ? `<img src="${toFileUrl(image)}" alt="">` : `<div class="placeholder">${escapeHtml(initials(person.name))}</div>`}</div>
    <div class="card-footer">
      <div class="name">${escapeHtml(person.name)}</div>
      <div class="shine"></div>
      <div class="percent">${formatPercent(person.percentage)}</div>
    </div>
  </article>`;
}

function renderLegend(item, index, legendNameSize) {
  const rank = index + 1;
  const theme = getTheme(rank);
  return `<div class="legend-item" style="--accent:${theme.accent}; --badge-bg:${theme.badge}; --legend-size:${legendNameSize}px;">
    <div class="badge">${rank}</div>
    <div class="legend-name">${escapeHtml(item.name)}</div>
  </div>`;
}

function renderBar(item, index) {
  const theme = getTheme(index + 1);
  return `<div class="bar-row" style="--accent:${theme.accent}; --value:${item.percentage};">
    <div class="bar-track"><div class="bar"></div></div>
    <div class="bar-value">${formatPercent(item.percentage)}</div>
  </div>`;
}

function getTheme(rank) {
  if (rank === 1) return { accent: "#ffc619", badge: "linear-gradient(180deg,#ffd753,#b98100)" };
  if (rank === 2) return { accent: "#e7e9ed", badge: "linear-gradient(180deg,#ffffff,#8d949d)" };
  if (rank === 3) return { accent: "#f4761e", badge: "linear-gradient(180deg,#fb8b31,#9c3f07)" };
  return { accent: "#0877f2", badge: "rgba(8,18,31,.78)" };
}

function renderLogo(logoImage) {
  if (logoImage) return `<img src="${toFileUrl(logoImage)}" alt="">`;
  return `<div class="brand-fallback">DİDEK<small>DİJİTAL İZLEME VE DEĞERLEME KURULU</small></div>`;
}

function getTop3Images(dir) {
  return {
    1: findAsset(dir, "1"),
    2: findAsset(dir, "2"),
    3: findAsset(dir, "3")
  };
}

function getLogoImage(dir) {
  return findAsset(dir, "logo") || findFirstAsset(dir);
}

function getSocialImages(dir) {
  const preferred = ["x", "instagram", "facebook", "youtube"];
  const direct = preferred.map((name) => findAsset(dir, name)).filter(Boolean);
  if (direct.length) return direct;
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(isImage)
    .sort((a, b) => a.localeCompare(b, "tr"))
    .map((file) => path.join(dir, file))
    .slice(0, 4);
}

function renderSocialIcons(images) {
  if (!images.length) return `<div class="source-icon">◎</div>`;
  return `<div class="social-icons">${images
    .map((image) => `<img src="${toFileUrl(image)}" alt="">`)
    .join("")}</div>`;
}

function renderPressIcon() {
  return `<div class="source-icon">
    <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <rect x="10" y="8" width="28" height="32" rx="2"></rect>
      <path d="M16 16h16M16 22h16M16 28h16M16 34h10"></path>
      <path d="M38 14h4v22a4 4 0 0 1-4 4"></path>
    </svg>
  </div>`;
}

function renderTvIcon() {
  return `<div class="source-icon">
    <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="14" width="30" height="22" rx="3"></rect>
      <path d="M18 40h12M24 36v4M16 8l8 6 8-6"></path>
      <circle cx="34" cy="20" r="1.3" fill="currentColor" stroke="none"></circle>
      <circle cx="34" cy="26" r="1.3" fill="currentColor" stroke="none"></circle>
    </svg>
  </div>`;
}

function renderMethodText(text, totalInteractions) {
  const prepared = text.replaceAll("{total}", totalInteractions);
  const escapedTotal = escapeHtml(totalInteractions);
  return prepared
    .split("\n")
    .map((line) => {
      const escapedLine = escapeHtml(line);
      return escapedLine.replace(escapedTotal, `<strong>${escapedTotal}</strong>`);
    })
    .join("<br>");
}

function findAsset(dir, basename) {
  if (!fs.existsSync(dir)) return "";

  for (const extension of [".png", ".jpg", ".jpeg", ".webp", ".svg"]) {
    const filePath = path.join(dir, `${basename}${extension}`);
    if (fs.existsSync(filePath)) return filePath;
  }

  const normalizedBase = basename.toLocaleLowerCase("tr-TR");
  const match = fs.readdirSync(dir).find((file) => {
    const parsed = path.parse(file);
    return parsed.name.toLocaleLowerCase("tr-TR") === normalizedBase && isImage(file);
  });

  return match ? path.join(dir, match) : "";
}

function findFirstAsset(dir) {
  if (!fs.existsSync(dir)) return "";
  const match = fs
    .readdirSync(dir)
    .filter(isImage)
    .sort((a, b) => a.localeCompare(b, "tr"))
    .at(0);

  return match ? path.join(dir, match) : "";
}

function isImage(file) {
  return [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(path.extname(file).toLocaleLowerCase("tr-TR"));
}

function formatPercent(value) {
  return `${Number(value).toFixed(2).replace(".", ",")}%`;
}

function fitFontSizeToWidth(text, maxWidth, maxSize, minSize) {
  const weightedLength = Array.from(String(text)).reduce((total, char) => {
    if (char === " ") return total + 0.35;
    if ("İIWMĞÜŞÖÇ".includes(char)) return total + 1.18;
    if (char === "." || char === "," || char === "-") return total + 0.35;
    return total + 1;
  }, 0);

  const estimatedSize = Math.floor(maxWidth / Math.max(1, weightedLength * 0.58));
  return Math.max(minSize, Math.min(maxSize, estimatedSize));
}

function formatArgText(value) {
  if (!value) return "";
  return String(value).replaceAll("\\n", "\n");
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("tr-TR");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
