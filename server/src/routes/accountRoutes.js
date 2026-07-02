const express = require("express");
const Stripe = require("stripe");

const { getSupabase } = require("../lib/supabase");
const { requireUser, requirePremium, getProfile, ensureProfile } = require("../lib/authMiddleware");

const router = express.Router();

const VALID_GAMES = new Set(["mm2", "adoptme", "growagarden"]);
const PREMIUM_PRICE_CENTS = Number(process.env.PREMIUM_PRICE_CENTS || 500);
const PREMIUM_CURRENCY = process.env.PREMIUM_CURRENCY || "usd";
const MAX_FAVORITES_PER_GAME = 500;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

async function activatePremium(userId, sessionId) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      premium: true,
      premium_since: new Date().toISOString(),
      stripe_session_id: sessionId,
    })
    .eq("id", userId);
  if (error) throw error;
}

// GET /api/account/me — profile + premium status (creates profile on first call)
router.get("/me", requireUser, async (req, res, next) => {
  try {
    const profile = await ensureProfile(req.user);
    res.json({ email: profile.email, premium: profile.premium, premiumSince: profile.premium_since });
  } catch (err) {
    next(err);
  }
});

// GET /api/account/favorites — all synced favorites across games
router.get("/favorites", requireUser, requirePremium, async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("favorites")
      .select("game, item_id")
      .eq("user_id", req.user.id);
    if (error) throw error;
    res.json({ favorites: data || [] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/account/favorites/:game — replace the favorite set for one game
router.put("/favorites/:game", requireUser, requirePremium, async (req, res, next) => {
  const { game } = req.params;
  if (!VALID_GAMES.has(game)) {
    return res.status(400).json({ message: "Unknown game" });
  }

  const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : null;
  if (!itemIds || itemIds.some((id) => typeof id !== "string" || !id)) {
    return res.status(400).json({ message: "itemIds must be an array of strings" });
  }
  if (itemIds.length > MAX_FAVORITES_PER_GAME) {
    return res.status(400).json({ message: `Too many favorites (max ${MAX_FAVORITES_PER_GAME})` });
  }

  try {
    const supabase = getSupabase();
    const unique = [...new Set(itemIds)];

    const { error: delError } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", req.user.id)
      .eq("game", game);
    if (delError) throw delError;

    if (unique.length) {
      const rows = unique.map((itemId) => ({ user_id: req.user.id, game, item_id: itemId }));
      const { error: insError } = await supabase.from("favorites").insert(rows);
      if (insError) throw insError;
    }

    res.json({ ok: true, count: unique.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/account/notifications — latest alerts + unread count
router.get("/notifications", requireUser, requirePremium, async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, game, item_id, item_name, old_value, new_value, move_at, read")
      .eq("user_id", req.user.id)
      .order("move_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    const notifications = data || [];
    const unreadCount = notifications.filter((n) => !n.read).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

// POST /api/account/notifications/read — mark everything read
router.post("/notifications/read", requireUser, requirePremium, async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", req.user.id)
      .eq("read", false);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/account/premium-session — Stripe Checkout for the one-time unlock
router.post("/premium-session", requireUser, async (req, res, next) => {
  try {
    const profile = await ensureProfile(req.user);
    if (profile.premium) {
      return res.status(400).json({ message: "Premium is already unlocked on this account" });
    }

    const { successUrl, cancelUrl } = req.body || {};
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ message: "Missing successUrl/cancelUrl" });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: PREMIUM_CURRENCY,
            product_data: {
              name: "GodlyWatch Premium",
              description: "One-time unlock: synced favorites + price alerts",
            },
            unit_amount: PREMIUM_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      customer_email: req.user.email || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: "gw-premium",
        user_id: req.user.id,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// POST /api/account/confirm-premium — fallback activation without a webhook:
// the client returns from Checkout with the session id and we verify payment
// directly with Stripe before unlocking.
router.post("/confirm-premium", requireUser, async (req, res, next) => {
  const { sessionId } = req.body || {};
  if (!sessionId) {
    return res.status(400).json({ message: "Missing sessionId" });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const isPremiumSession = session?.metadata?.type === "gw-premium";
    const isOwner = session?.metadata?.user_id === req.user.id;
    const isPaid = session?.payment_status === "paid";
    if (!isPremiumSession || !isOwner || !isPaid) {
      return res.status(400).json({ message: "Payment could not be verified" });
    }

    await activatePremium(req.user.id, session.id);
    const profile = await getProfile(req.user.id);
    res.json({ premium: profile.premium });
  } catch (err) {
    next(err);
  }
});

// POST /api/account/stripe-webhook — primary activation path when a webhook
// secret is configured. Raw body is registered in app.js before express.json.
router.post("/stripe-webhook", async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(501).json({ message: "Webhook secret not configured" });
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ message: "Invalid signature" });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.metadata?.type === "gw-premium" && session.metadata?.user_id && session.payment_status === "paid") {
        await activatePremium(session.metadata.user_id, session.id);
        console.log(`[premium] activated via webhook for user ${session.metadata.user_id}`);
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handling failed:", err.message);
    res.status(500).json({ message: "Webhook handling failed" });
  }
});

module.exports = router;
