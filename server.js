import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/search", async (req, res) => {
  const q = req.query.q || "";
  const url = `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`;

  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);
    const items = [];

    $("div[data-id]").slice(0, 5).each((_, el) => {
      const title =
        $(el).find("a[title]").attr("title") ||
        $(el).find("a").first().text().trim();
      const price = $(el).find("div._30jeq3").first().text();
      const rating = $(el).find("div._3LWZlK").first().text();
      const link = "https://www.flipkart.com" + $(el).find("a").first().attr("href");
      const image = $(el).find("img").attr("src");

      if (title && price) {
        items.push({ site: "Flipkart", title, price, rating, link, image });
      }
    });

    res.json({ query: q, items, cached: false });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to scrape Flipkart" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
