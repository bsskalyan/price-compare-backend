import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

// Helper: parse price
function parsePrice(text) {
  if (!text) return null;
  const num = text.replace(/[^\d]/g, "");
  return num ? parseInt(num, 10) : null;
}

// Amazon mobile scraper
async function scrapeAmazonMobile(query) {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) " +
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 " +
        "Mobile/15E148 Safari/604.1",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const $ = cheerio.load(data);
  const items = [];

  $("div.s-result-item").each((i, el) => {
    const title = $(el).find("h2 span").text().trim();
    const priceTxt = $(el).find("span.a-price .a-offscreen").first().text().trim();
    const price = parsePrice(priceTxt);
    const link =
      "https://www.amazon.in" + ($(el).find("a.a-link-normal").attr("href") || "");
    const image = $(el).find("img.s-image").attr("src");

    if (title && price) {
      items.push({ site: "Amazon", title, price: priceTxt, link, image });
    }
  });

  return items.slice(0, 5); // return top 5 results
}

// API route
app.get("/api/amazon", async (req, res) => {
  const q = req.query.q || "";
  try {
    const items = await scrapeAmazonMobile(q);
    res.json({ query: q, items });
  } catch (e) {
    console.error("Amazon error:", e.message);
    res.json({ query: q, items: [], error: e.message });
  }
});

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
