const express = require("express");
const cors = require("cors");

const marketRoutes = require("./routes/marketRoutes");
const refreshRoutes = require("./routes/refreshRoutes");
const imageRoutes = require("./routes/imageRoutes");

const app = express();

const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "https://godlywatch.com",
  "https://www.godlywatch.com",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
}));

app.use(express.json({ limit: "10mb" }));

app.use("/api/market", marketRoutes);
app.use("/api/refresh", refreshRoutes);
app.use("/api/img", imageRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    message: err.message || "Internal server error"
  });
});

module.exports = app;