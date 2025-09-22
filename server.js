import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

// Flipkart scraper function
async function scrapeFlipkart(query) {
  const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

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
          return {
            site: "Flipkart",
            title,
            price,
            rating,
            url: "https://www.flipkart.com" + link,
            image
          };
        }
      })
      .filter(Boolean)
  );

  await browser.close();
  return items;
}

// API route
app.get("/api/search", async (req, res) => {
  const query = req.query.q || "";
  try {
    const items = await scrapeFlipkart(query);
    res.json({ query, items, cached: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to scrape Flipkart" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
