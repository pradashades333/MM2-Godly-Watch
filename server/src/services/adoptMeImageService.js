const WIKI_API_ROOT = "https://adoptme.fandom.com/api.php";
const BATCH_SIZE = 50;

let cachedImageMap = null;
let imageMapPromise = null;

function chunkArray(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

// Loosely normalizes a name/title for matching: strips whitespace and
// underscores and lowercases, since the wiki's "Pet" icon files use
// inconsistent spacing (e.g. "BatDragon Pet.png" vs "Frost Dragon Pet.png").
function normalizeKey(value) {
  return String(value).replace(/[\s_]+/g, "").toLowerCase();
}

const PET_ICON_PATTERN = /pet\.(png|jpg|jpeg|gif|webp)$/;

// The Adopt Me wiki curates a dedicated "<Pet Name> Pet.png"-style icon for
// most pets, listed among the page's `images`. Find it via loose matching.
function findPetIconTitle(name, images) {
  const target = normalizeKey(name);
  for (const image of images || []) {
    const title = image?.title;
    if (!title) continue;
    const fileName = title.replace(/^File:/, "");
    const normalized = normalizeKey(fileName);
    if (PET_ICON_PATTERN.test(normalized) && normalized.startsWith(`${target}pet.`)) {
      return title;
    }
  }
  return null;
}

// Queries pageimages + images for a batch of pet entries, following
// redirects/normalization and merging `images` across `continue` pages
// (a single batch of pages can exceed the `imlimit=max` images-per-request).
// `entries` is [{ name, title }] so fallback lookups can query an alternate
// page title while still recording results under the original pet name.
async function fetchImageBatch(entries) {
  const titleToName = new Map(entries.map(({ name, title }) => [title, name]));
  const pageMeta = new Map(); // pageid -> { title, missing, thumbnail }
  const pageImages = new Map(); // pageid -> images[]

  let params = {
    action: "query",
    titles: entries.map(({ title }) => title).join("|"),
    prop: "pageimages|images",
    piprop: "thumbnail",
    pithumbsize: "300",
    imlimit: "max",
    redirects: "1",
    format: "json",
    origin: "*"
  };

  for (let guard = 0; guard < 10; guard++) {
    const url = new URL(WIKI_API_ROOT);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

    const response = await fetch(url);
    if (!response.ok) break;
    const payload = await response.json();
    const query = payload?.query;
    if (!query) break;

    for (const { from, to } of query.normalized || []) {
      const name = titleToName.get(from);
      if (name) titleToName.set(to, name);
    }
    for (const { from, to } of query.redirects || []) {
      const name = titleToName.get(from);
      if (name) titleToName.set(to, name);
    }

    for (const page of Object.values(query.pages || {})) {
      const existing = pageMeta.get(page.pageid);
      pageMeta.set(page.pageid, {
        title: page.title,
        missing: "missing" in page,
        thumbnail: existing?.thumbnail ?? page.thumbnail
      });
      if (Array.isArray(page.images)) {
        const list = pageImages.get(page.pageid) || [];
        list.push(...page.images);
        pageImages.set(page.pageid, list);
      }
    }

    if (!payload.continue) break;
    params = { ...params, ...payload.continue };
  }

  const results = {};
  for (const [pageid, meta] of pageMeta) {
    const name = titleToName.get(meta.title);
    if (!name || meta.missing) continue;

    const iconTitle = findPetIconTitle(name, pageImages.get(pageid));
    if (iconTitle) {
      results[name] = { iconTitle };
    } else if (meta.thumbnail?.source) {
      results[name] = { thumbnail: meta.thumbnail.source };
    }
  }

  return results;
}

// For pets whose name doesn't match a wiki page directly (different
// capitalization, "(Pet)" disambiguation suffix, alternate spelling, etc.),
// looks up the top full-text search result to use as an alternate title.
async function findAlternateTitles(names) {
  const entries = [];

  await Promise.all(
    names.map(async (name) => {
      const url = new URL(WIKI_API_ROOT);
      url.searchParams.set("action", "query");
      url.searchParams.set("list", "search");
      url.searchParams.set("srsearch", name);
      url.searchParams.set("srnamespace", "0");
      url.searchParams.set("srlimit", "1");
      url.searchParams.set("format", "json");
      url.searchParams.set("origin", "*");

      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const payload = await response.json();
        const title = payload?.query?.search?.[0]?.title;
        if (title) entries.push({ name, title });
      } catch (err) {
        console.error("[adoptme] wiki search fallback failed:", err.message);
      }
    })
  );

  return entries;
}

// Resolves a batch of "File:..." titles to their CDN URLs.
async function resolveFileUrls(titles) {
  const mappings = {};

  for (const batch of chunkArray(titles, BATCH_SIZE)) {
    const url = new URL(WIKI_API_ROOT);
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", batch.join("|"));
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const payload = await response.json();
      for (const page of Object.values(payload?.query?.pages || {})) {
        if ("missing" in page) continue;
        const imageUrl = page?.imageinfo?.[0]?.url;
        if (imageUrl) mappings[page.title] = imageUrl;
      }
    } catch (err) {
      console.error("[adoptme] wiki file url batch request failed:", err.message);
    }
  }

  return mappings;
}

function mergeBatchResults(batchResults, imageMap, iconTitleByName) {
  for (const [name, result] of Object.entries(batchResults)) {
    if (result.iconTitle) {
      iconTitleByName[name] = result.iconTitle;
    } else if (result.thumbnail) {
      imageMap[name] = result.thumbnail;
    }
  }
}

async function buildImageMap(petNames) {
  const imageMap = {};
  const iconTitleByName = {};

  const entries = petNames.map((name) => ({ name, title: name }));
  for (const batch of chunkArray(entries, BATCH_SIZE)) {
    try {
      mergeBatchResults(await fetchImageBatch(batch), imageMap, iconTitleByName);
    } catch (err) {
      console.error("[adoptme] wiki image batch request failed:", err.message);
    }
  }

  // Second pass: pets with no direct page match (renamed/disambiguated
  // wiki titles) get one more try via full-text search.
  const unmapped = petNames.filter((name) => !imageMap[name] && !iconTitleByName[name]);
  if (unmapped.length) {
    const altEntries = await findAlternateTitles(unmapped);
    for (const batch of chunkArray(altEntries, BATCH_SIZE)) {
      try {
        mergeBatchResults(await fetchImageBatch(batch), imageMap, iconTitleByName);
      } catch (err) {
        console.error("[adoptme] wiki image fallback batch request failed:", err.message);
      }
    }
  }

  const iconTitles = [...new Set(Object.values(iconTitleByName))];
  if (iconTitles.length) {
    const resolved = await resolveFileUrls(iconTitles);
    for (const [name, iconTitle] of Object.entries(iconTitleByName)) {
      const resolvedUrl = resolved[iconTitle];
      if (resolvedUrl) imageMap[name] = resolvedUrl;
    }
  }

  return imageMap;
}

// Returns a map of pet name -> wiki image URL, preferring each pet's curated
// "Pet" icon and falling back to the wiki page's lead thumbnail. Pets with no
// matching wiki page are left unmapped so callers can fall back elsewhere.
// Cached for the lifetime of the process since the wiki rarely changes.
async function getPetImageMap(petNames) {
  if (cachedImageMap) return cachedImageMap;

  if (!imageMapPromise) {
    imageMapPromise = buildImageMap(petNames)
      .then((mappings) => {
        cachedImageMap = mappings;
        return mappings;
      })
      .catch((err) => {
        console.error("[adoptme] failed to load wiki pet image mappings:", err.message);
        return {};
      });
  }

  return imageMapPromise;
}

module.exports = { getPetImageMap };
