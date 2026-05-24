const express = require("express");
const { writeHistory } = require("../services/historyService");

const router = express.Router();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "gw-restore-2026";

router.post("/restore-history", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const items = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "Body must be a non-empty array" });
  }

  await writeHistory(items);
  res.json({ message: "History restored", count: items.length });
});

module.exports = router;
