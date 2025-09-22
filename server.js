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
async function scrapeFlipkart(query) {
  const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll("div._1AtVbE"))
      .map(card => {
        const title = card.querySelector("a.s1Q9rs, a.IRpwTa, div._4rR01T")?.innerText;
        const price = card.querySelector("div._30jeq3")?.innerText;
        const rating = card.querySelector("div._3LWZlK")?.innerText;
        const link = card.querySelector("a")?.href;
        const image = card.querySelector("img")?.src;
        if (title && price) {
          return { site: "Flipkart", title, price, rating, url: "https://www.flipkart.com" + link, image };
        }
      })
      .filter(Boolean)
  );

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
