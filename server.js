import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// 🔹 Flipkart scraper
async function scrapeFlipkart(query) {
  try {
    const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const $ = cheerio.load(data);
    const items = [];

    $("div._1AtVbE").each((i, el) => {
      const title = $(el).find("div._4rR01T").text().trim();
      const price = $(el).find("div._30jeq3").text().trim();
      const rating = $(el).find("div._3LWZlK").text().trim();
      const link = "https://www.flipkart.com" + $(el).find("a").attr("href");
      const image = $(el).find("img").attr("src");

      if (title && price) {
        items.push({ site: "Flipkart", title, price, rating, link, image });
      }
    });

    return items.slice(0, 5); // limit to top 5 results
  } catch (err) {
    console.error("Flipkart scrape failed:", err.message);
    return [];
  }
}

// 🔹 Amazon scraper
async function scrapeAmazon(query) {
  try {
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const $ = cheerio.load(data);
    const items = [];

    $("div.s-main-slot div[data-component-type='s-search-result']").each((i, el) => {
      const title = $(el).find("h2 a span").text().trim();
      const price = $(el).find("span.a-price-whole").text().trim();
      const rating = $(el).find("span.a-icon-alt").text().trim();
      const link = "https://www.amazon.in" + $(el).find("h2 a").attr("href");
      const image = $(el).find("img").attr("src");

      if (title && price) {
        items.push({ site: "Amazon", title, price, rating, link, image });
      }
    });

    return items.slice(0, 5);
  } catch (err) {
    console.error("Amazon scrape failed:", err.message);
    return [];
  }
}

// 🔹 API endpoint
app.get("/api/search", async (req, res) => {
  const q = req.query.q || "";
  if (!q) return res.json({ query: q, items: [], cached: false });

  const [flipkartItems, amazonItems] = await Promise.all([
    scrapeFlipkart(q),
    scrapeAmazon(q)
  ]);

  const items = [...flipkartItems, ...amazonItems];

  res.json({ query: q, items, cached: false });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
