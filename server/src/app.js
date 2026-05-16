const express = require("express");
const cors = require("cors");

const marketRoutes = require("./routes/marketRoutes");
const refreshRoutes = require("./routes/refreshRoutes");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
}));

app.use(express.json());

app.use("/api/market", marketRoutes);
app.use("/api/refresh", refreshRoutes);

module.exports = app;