import express from "express";
import puppeteer from "puppeteer";
import cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/search", async (req, res) => {
  const q = req.query.q || "";
  res.json({ query: q, items: ["test item"], cached: false });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
