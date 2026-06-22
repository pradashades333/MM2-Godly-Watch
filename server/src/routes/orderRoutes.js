const express = require("express");
const Stripe = require("stripe");

const router = express.Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

async function sendDiscordNotification({ items, discord, total, method }) {
  const webhookUrl = process.env.DISCORD_ORDER_WEBHOOK;
  if (!webhookUrl) return;

  const lines = items.map(i => `• **${i.name}** x${i.qty} — €${(i.price * i.qty).toFixed(2)}`).join("\n");
  const embed = {
    title: "🛒 New Order",
    color: 0x5eff8d,
    fields: [
      { name: "Discord", value: discord || "—", inline: true },
      { name: "Total", value: `€${Number(total).toFixed(2)}`, inline: true },
      { name: "Payment", value: method || "unknown", inline: true },
      { name: "Items", value: lines },
    ],
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error("Webhook failed:", err.message);
  }
}

// POST /api/order — manual / post-PayPal record
router.post("/", async (req, res) => {
  const { items, discord, total, method } = req.body;
  if (!items?.length) return res.status(400).json({ message: "Missing items" });

  await sendDiscordNotification({ items, discord, total, method: method || "PayPal" });
  res.json({ ok: true });
});

// POST /api/order/stripe-session — create Stripe Checkout session
router.post("/stripe-session", async (req, res) => {
  const { items, discord, total, successUrl, cancelUrl } = req.body;
  if (!items?.length) return res.status(400).json({ message: "Missing items" });

  try {
    const stripe = getStripe();

    const lineItems = items.map(i => ({
      price_data: {
        currency: "eur",
        product_data: { name: i.name },
        unit_amount: Math.round(i.price * 100),
      },
      quantity: i.qty,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        discord: discord || "",
        item_names: items.map(i => `${i.name} x${i.qty}`).join(", "),
        total: String(total),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe session error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/order/stripe-webhook — Stripe confirms payment, send Discord notification
router.post("/stripe-webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).end();
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { discord, item_names, total } = session.metadata || {};
    sendDiscordNotification({
      items: [{ name: item_names || "Order", qty: 1, price: Number(total) || 0 }],
      discord,
      total,
      method: "Stripe",
    });
  }

  res.json({ received: true });
});

module.exports = router;
