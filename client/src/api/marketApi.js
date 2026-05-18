import { apiRequest } from "./client";

export function getMarketData() {
  return apiRequest("/market");
}

export function getMarketItems() {
  return apiRequest("/market/items");
}

export function getMarketStats() {
  return apiRequest("/market/stats");
}

export function getRecentMoves() {
  return apiRequest("/market/recent-moves");
}

export function refreshMarketData() {
  return apiRequest("/refresh", {
    method: "POST"
  });
}
