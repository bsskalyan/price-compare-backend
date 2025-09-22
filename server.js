import express from "express";
import cors from "cors";
import morgan from "morgan";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan("dev"));

/** Helpers */
const headersDesktop = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
  "Accept-Language": "en-IN,en;q=0.9",
  "Referer": "https://www.amazon.in/"
};
const headersMobile = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Mobile Safari/537.36",
  "Accept-Language": "en-IN,en;q=0.9",
  "Referer": "https://m.amazon.in/"
};

function parsePrice(text) {
  if (!text) return null;
  const digits = text.replace(/[^\d.]/g, "");
  return digits ? Number(digits.replace(/\.([0-9]{2})$/, "")) : null;
}
function normalizeItem(it) {
  return {
    site: "Amazon",
    title: it.title || "",
    price: it.price ?? null,
    rating: it.rating ?? null,
    url: it.url || "#",
    image: it.image || null,
    delivery: it.delivery ?? null,
    discount: it.discount ?? null
  };
}

/** Scrapers */
async function scrapeAmazonDesktop(query, limit = 10) {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
  const { data } = await axios.get(url, { headers: headersDesktop, timeout: 15000 });
  // If Amazon serves a bot page it often contains "Robot Check" or captcha
  if (/Robot Check|captcha/i.test(data)) throw new Error("blocked-desktop");

  const $ = cheerio.load(data);
  const results = [];

  $("div.s-main-slot div[data-component-type='s-search-result']")
    .slice(0, limit)
    .each((_, el) => {
      const title = $(el).find("h2 a span").text().trim();
      const priceWhole = $(el).find("span.a-price-whole").first().text().trim();
      const priceFrac = $(el).find("span.a-price-fraction").first().text().trim();
      const price = parsePrice(`${priceWhole}${priceFrac ? "." + priceFrac : ""}`);
      const ratingTxt = $(el).find("span.a-icon-alt").first().text().trim(); // like "4.5 out of 5 stars"
      const rating = ratingTxt ? Number((ratingTxt.match(/[\d.]+/) || [])[0]) : null;
      const href = $(el).find("h2 a").attr("href");
      const url = href ? new URL(href, "https://www.amazon.in").href : "#";
      const image =
        $(el).find("img.s-image").attr("src") ||
        $(el).find("img.s-image").attr("data-src");

      if (title && (price !== null || rating !== null)) {
        results.push(normalizeItem({ title, price, rating, url, image }));
      }
    });

  return results;
}

async function scrapeAmazonMobile(query, limit = 10) {
  const url = `https://m.amazon.in/s?k=${encodeURIComponent(query)}`;
  const { data } = await axios.get(url, { headers: headersMobile, timeout: 15000 });
  if (/Robot Check|captcha/i.test(data)) throw new Error("blocked-mobile");

  const $ = cheerio.load(data);
  const results = [];

  // Mobile DOM is different
  $("div[data-component-type='s-search-result']")
    .slice(0, limit)
    .each((_, el) => {
      const title = $(el).find("h2 a span").text().trim();
      const priceTxt = $(el).find("span.a-price-whole").first().text().trim();
      const price = parsePrice(priceTxt);
      const ratingTxt = $(el).find("span.a-icon-alt").first().text().trim();
      const rating = ratingTxt ? Number((ratingTxt.match(/[\d.]+/) || [])[0]) : null;
      const href = $(el).find("h2 a").attr("href");
      const url = href ? new URL(href, "https://www.amazon.in").href : "#";
      const image =
        $(el).find("img.s-image").attr("src") ||
        $(el).find("img.s-image").attr("data-src");

      if (title && (price !== null || rating !== null)) {
        results.push(normalizeItem({ title, price, rating, url, image }));
      }
    });

  return results;
}

async function searchAmazon(query) {
  try {
    const desktop = await scrapeAmazonDesktop(query);
    if (desktop.length) return { items: desktop, source: "desktop" };
    // Fall back to mobile if desktop returned nothing
    const mobile = await scrapeAmazonMobile(query);
    return { items: mobile, source: "mobile" };
  } catch (e) {
    // If desktop blocked -> try mobile; if mobile also blocks -> return empty
    if (e.message === "blocked-desktop") {
      try {
        const mobile = await scrapeAmazonMobile(query);
        return { items: mobile, source: "mobile" };
      } catch {
        return { items: [], source: "blocked" };
      }
    }
    console.error("Amazon error:", e.message);
    if (e.response) {
      console.error("Status:", e.response.status);
      console.error("Body snippet:", e.response.data.slice(0, 300));
    }
    return { items: [], source: "error" };
  }
}

/** Routes */
// quick health
app.get("/api/health", (_, res) => res.json({ ok: true }));

// test amazon directly
app.get("/api/amazon", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ error: "Missing ?q" });

  const { items, source } = await searchAmazon(q);
  res.json({ query: q, items, source });
});

// keep your frontend working (search -> now returns Amazon only for now)
app.get("/api/search", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.json({ query: q, items: [], cached: false });

  const { items, source } = await searchAmazon(q);
  res.json({ query: q, items, cached: false, source });
});

app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});
