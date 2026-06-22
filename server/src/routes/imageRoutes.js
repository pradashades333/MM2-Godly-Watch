const express = require("express");

const router = express.Router();

const ALLOWED_HOSTS = ["static.wikia.nocookie.net", "amvgg.com", "cdn.nookazon.com"];

router.get("/", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ message: "Missing url param" });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ message: "Invalid url" });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return res.status(403).json({ message: "URL not allowed" });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GodlyWatch/1.0)",
        "Accept": "image/webp,image/png,image/*,*/*",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).end();
    }

    const contentType = upstream.headers.get("content-type") || "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");

    const buffer = await upstream.arrayBuffer();
    res.end(Buffer.from(buffer));
  } catch (err) {
    console.error("Image proxy error:", err.message);
    res.status(502).end();
  }
});

module.exports = router;
