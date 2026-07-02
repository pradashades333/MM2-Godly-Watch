const { getSupabase } = require("./supabase");

// Verifies the Supabase access token from the Authorization header and
// attaches req.user. 503 when accounts aren't configured so the client can
// hide account features gracefully.
async function requireUser(req, res, next) {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ message: "Accounts are not configured on this server" });
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Sign in required" });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }
    req.user = data.user;
    next();
  } catch (err) {
    next(err);
  }
}

async function getProfile(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, premium, premium_since")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Creates the profile row on first contact; leaves premium untouched after.
async function ensureProfile(user) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email }, { onConflict: "id" })
    .select("id, email, premium, premium_since")
    .single();
  if (error) throw error;
  return data;
}

// Use after requireUser. 402 tells the client to show the premium upsell.
async function requirePremium(req, res, next) {
  try {
    const profile = await getProfile(req.user.id);
    if (!profile?.premium) {
      return res.status(402).json({ message: "Premium required" });
    }
    req.profile = profile;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireUser, requirePremium, getProfile, ensureProfile };
