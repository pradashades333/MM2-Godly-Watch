require("dotenv").config();

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const EBAY_ENV = process.env.EBAY_ENV || "production";

const EBAY_API_ROOT =
  EBAY_ENV === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";

async function getEbayAccessToken() {
  const credentials = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${EBAY_API_ROOT}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay auth failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function searchEbay(query, accessToken) {
    const url = new URL(`${EBAY_API_ROOT}/buy/browse/v1/item_summary/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "10");

    const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`eBay search failed: ${response.status} ${text}`);
    }

  return response.json();
}

async function test() {
  const token = await getEbayAccessToken();
  const results = await searchEbay("Murder Mystery 2 Bat", token);
  console.log(JSON.stringify(results, null, 2));
}

test().catch(console.error);