const marketService = require("../services/marketService");
const adoptMeService = require("../services/adoptMeService");
const growAGardenService = require("../services/growAGardenService");

// Registry of supported games. To add a new game: create a service module
// exposing the same interface (getMarketData, getMarketItems,
// getMarketItemById, getRecentMoves, getStats, refreshMarketData) and add
// an entry here.
const GAMES = {
  mm2: { id: "mm2", label: "MM2", service: marketService },
  adoptme: { id: "adoptme", label: "Adopt Me", service: adoptMeService },
  growagarden: { id: "growagarden", label: "Grow a Garden", service: growAGardenService }
};

const DEFAULT_GAME = "mm2";

function getGame(gameId) {
  return GAMES[gameId] || GAMES[DEFAULT_GAME];
}

module.exports = { GAMES, DEFAULT_GAME, getGame };
