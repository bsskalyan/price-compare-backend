import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/search", async (req, res) => {
  const q = req.query.q || "";

  // Temporary dummy data (replace with real scraping later)
  const items = [
    {
      site: "Flipkart",
      title: "Apple iPhone 14 (Blue, 128 GB)",
      price: "₹56,999",
      rating: "4.6",
      link: "https://www.flipkart.com/apple-iphone-14/p/itm...",
      image: "https://rukminim2.flixcart.com/image/iphone14.jpg"
    },
    {
      site: "Amazon",
      title: "Apple iPhone 14 (Blue, 128 GB)",
      price: "₹57,490",
      rating: "4.5",
      link: "https://www.amazon.in/dp/B0BDK62PDX",
      image: "https://m.media-amazon.com/images/iphone14.jpg"
    }
  ];

  res.json({ query: q, items, cached: false });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
