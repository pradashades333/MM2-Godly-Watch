import { apiRequest } from "./client";

function gameQuery(game) {
  return game ? `?game=${encodeURIComponent(game)}` : "";
}

export function getMarketData(game) {
  return apiRequest(`/market${gameQuery(game)}`);
}

export function getMarketItems(game) {
  return apiRequest(`/market/items${gameQuery(game)}`);
}

export function getMarketStats(game) {
  return apiRequest(`/market/stats${gameQuery(game)}`);
}

export function getRecentMoves(game) {
  return apiRequest(`/market/recent-moves${gameQuery(game)}`);
}

export function refreshMarketData() {
  return apiRequest("/refresh", {
    method: "POST"
  });
}
