const fs = require("fs/promises");
const path = require("path");

const HISTORY_FILE = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "history.json")
  : path.join(__dirname, "..", "data", "history.json");
const MAX_HISTORY_POINTS = 180;

async function readHistory() {
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function writeHistory(items) {
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
  await fs.writeFile(HISTORY_FILE, JSON.stringify(items, null, 2), "utf8");
}

function createHistoryPoint(item) {
  return {
    timestamp: item.lastCheckedAt || new Date().toISOString(),
    supremeValue: item.current?.supreme?.value ?? null,
    ebayPrice: item.current?.ebay?.price ?? null,
    ebayCurrency: item.current?.ebay?.currency ?? null
  };
}

function appendHistoryPoint(existingHistory, item) {
  const history = Array.isArray(existingHistory) ? [...existingHistory] : [];
  const nextPoint = createHistoryPoint(item);

  const lastPoint = history[history.length - 1];

  const isDuplicate =
    lastPoint &&
    lastPoint.supremeValue === nextPoint.supremeValue &&
    lastPoint.ebayPrice === nextPoint.ebayPrice;

  if (!isDuplicate) {
    history.push(nextPoint);
  }

  return history.slice(-MAX_HISTORY_POINTS);
}

function mergeItem(previousItem, freshItem) {
  return {
    ...previousItem,
    ...freshItem,
    history: appendHistoryPoint(previousItem?.history, freshItem)
  };
}

function mergeSnapshots(previousItems, freshItems) {
  const previousMap = new Map(previousItems.map((item) => [item.id, item]));
  const merged = [];

  for (const freshItem of freshItems) {
    const previousItem = previousMap.get(freshItem.id);

    if (previousItem) {
      merged.push(mergeItem(previousItem, freshItem));
      previousMap.delete(freshItem.id);
    } else {
      merged.push({
        ...freshItem,
        history: [createHistoryPoint(freshItem)]
      });
    }
  }

  for (const leftover of previousMap.values()) {
    merged.push(leftover);
  }

  return merged;
}

function attachHistory(items, savedItems) {
  const savedMap = new Map(savedItems.map((item) => [item.id, item.history || []]));

  return items.map((item) => ({
    ...item,
    history: savedMap.get(item.id) || []
  }));
}

function getRecentMoves(items, limit = 20) {
  const moves = [];

  for (const item of items) {
    const history = Array.isArray(item.history)
      ? item.history.filter((point) => point.supremeValue != null)
      : [];

    if (history.length < 2) {
      continue;
    }

    const current = history[history.length - 1];
    let previous = null;

    for (let i = history.length - 2; i >= 0; i -= 1) {
      if (history[i].supremeValue !== current.supremeValue) {
        previous = history[i];
        break;
      }
    }

    if (!previous) {
      continue;
    }

    const diff = current.supremeValue - previous.supremeValue;
    if (!diff) {
      continue;
    }

    moves.push({
      id: item.id,
      name: item.name,
      category: item.category,
      previous: previous.supremeValue,
      current: current.supremeValue,
      diff,
      timestamp: current.timestamp
    });
  }

  return moves
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

module.exports = {
  readHistory,
  writeHistory,
  mergeSnapshots,
  attachHistory,
  getRecentMoves
};
