const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const NodeCache = require("node-cache");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");

const withTimeout = (p, ms = 15000, label = "task") =>
  Promise.race([p, new Promise((_, r)=>setTimeout(()=>r(new Error(`${label} timed out`)), ms))]);

const normalizeItem = (o)=>({
  site: o.site, title: o.title||"", price: o.price ?? null, rating: o.rating ?? null,
  url: o.url || "#", image: o.image || null, discount: o.discount ?? null
});

// ---- Flipkart scraper ----
async function searchFlipkart(q, limit = 6) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox","--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

  const url = `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });

  const html = await page.content();
  const $ = cheerio.load(html);
  const items = [];

  $("div[data-id]").slice(0, limit).each((_, el) => {
    const title = $(el).find("a[title]").attr("title") || $(el).find("a").first().text().trim();
    const priceText = $(el).find("div:contains(₹)").first().text().replace(/[^\d]/g, "");
    const price = priceText ? Number(priceText) : null;
    const ratingText = $(el).find("div[aria-label*='Ratings']").text().match(/[\d.]+/);
    const rating = ratingText ? Number(ratingText[0]) : null;
    const rel = $(el).find("a").first().attr("href") || "";
    const link = rel ? new URL(rel, "https://www.flipkart.com").href : "#";
    const img = $(el).find("img").attr("src") || $(el).find("img").attr("data-src");
    const discount = ($(el).find("div:contains('% off')").first().text().match(/(\d+)%/)||[])[1] || null;

    items.push(normalizeItem({ site:"Flipkart", title, price, rating, url: link, image: img, discount }));
  });

  await browser.close();
  return items;
}

// ---- Stubs for other sites ----
async function searchCroma(q){ return []; }
async function searchReliance(q){ return []; }
async function searchAmazon(q){ return []; }
async function searchSnapdeal(q){ return []; }
async function searchTataNeu(q){ return []; }
async function searchNaaptol(q){ return []; }
async function searchBigBasket(q){ return []; }
async function searchDmart(q){ return []; }

const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use("/api/", rateLimit({ windowMs: 60000, max: 20 }));

const cache = new NodeCache({ stdTTL: 300 });

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.get("/api/search", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ error: "Missing ?q" });

  const cached = cache.get(q);
  if (cached) return res.json({ query: q, items: cached, cached: true });

  try {
    const results = await Promise.allSettled([
      withTimeout(searchFlipkart(q), 15000, "flipkart"),
      withTimeout(searchCroma(q), 15000, "croma"),
      withTimeout(searchReliance(q), 15000, "reliance"),
      withTimeout(searchAmazon(q), 15000, "amazon"),
      withTimeout(searchSnapdeal(q), 15000, "snapdeal"),
      withTimeout(searchTataNeu(q), 15000, "tataneu"),
      withTimeout(searchNaaptol(q), 15000, "naaptol"),
      withTimeout(searchBigBasket(q), 15000, "bigbasket"),
      withTimeout(searchDmart(q), 15000, "dmart")
    ]);
    const items = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
    cache.set(q, items);
    res.json({ query: q, items, cached: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/suggest", (req, res) => {
  const q = (req.query.q||"").toString();
  res.json({ query: q, alternatives: [`${q} 128GB`, `${q} pro`, `${q} refurbished`] });
});

app.get("/api/smart-recommend", (req, res) => {
  try {
    const items = JSON.parse(req.query.items || "[]");
    const good = items.filter(x => (x.rating || 0) >= 4);
    const pick = (arr) => arr.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity))[0] || null;
    res.json({ pick: pick(good) || pick(items) || null });
  } catch { res.json({ pick: null }); }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
