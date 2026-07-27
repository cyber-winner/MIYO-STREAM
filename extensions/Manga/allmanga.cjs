const crypto = require("crypto");

const baseUrl = "https://allmanga.to/manga";
const apiUrl = "https://api.allanime.day/api";
const THUMBNAIL_CDN = "https://wp.youtube-anime.com/aln.youtube-anime.com/";

// Headers required by AllAnime API to avoid geo/bot blocking
const API_HEADERS = {
  "Referer": "https://allmanga.to/",
  "Origin": "https://allmanga.to",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "Content-Type": "application/json",
};

async function latestManga(page = 1) {
  return searchManga("", page);
}

async function searchManga(query, page = 1) {
  try {
    const { data } = await global.axios.post(apiUrl, {
      query: `query(
      $search: SearchInput
      $page: Int
      $translationType: VaildTranslationTypeMangaEnumType
      $countryOrigin: VaildCountryOriginEnumType
    ) {
      mangas(
        search: $search
        page: $page
        translationType: $translationType
        countryOrigin: $countryOrigin
      ) {
        edges {
          _id
          name
          thumbnail
        }
      }
    }`,
      variables: {
        search: {
          query: query || "",
          isManga: true,
          allowAdult: false,
          allowUnknown: false,
        },
        page: page,
        translationType: "sub",
        countryOrigin: "ALL",
      },
    });

    const edges = data?.data?.mangas?.edges || [];
    const results = edges.map((m) => ({
      id: m._id,
      title: m.name,
      image: m?.thumbnail
        ? m.thumbnail?.startsWith("http")
          ? m.thumbnail
          : `${THUMBNAIL_CDN}${m.thumbnail}?w=250`
        : null,
    }));

    return {
      currentPage: page,
      hasNextPage: results.length > 0,
      results: results,
    };
  } catch (err) {
    throw err;
  }
}

async function fetchMangaInfo(mangaId) {
  try {
    const gql = `query ($id: String!) {
      manga(_id: $id) {
        _id
        name
        thumbnail
        description
        authors
        genres
        tags
        status
        altNames
        englishName
      }
    }`;

    const { data } = await global.axios.post(apiUrl, {
      query: gql,
      variables: { id: mangaId },
    });

    const m = data?.data?.manga;
    if (!m) throw new Error("Manga not found");

    return {
      id: m._id,
      title: m.name,
      image: m?.thumbnail
        ? m.thumbnail?.startsWith("http")
          ? m.thumbnail
          : `${THUMBNAIL_CDN}${m.thumbnail}?w=250`
        : null,
      description: m.description || "",
      genres: m.genres || [],
      author: m.authors ? m.authors.join(", ") : "",
      type: "Manga",
      released: "",
      status: m.status || "",
    };
  } catch (err) {
    throw err;
  }
}

async function fetchChapters(mangaId) {
  try {
    const gql = `query ($id: String!) {
      manga(_id: $id) {
        _id
        availableChaptersDetail
      }
    }`;

    const { data } = await global.axios.post(apiUrl, {
      query: gql,
      variables: { id: mangaId },
    });

    const availableChaptersDetail = data?.data?.manga?.availableChaptersDetail;
    let chapters = [];
    if (availableChaptersDetail && availableChaptersDetail.sub) {
      const subChapters = availableChaptersDetail.sub;
      for (const ch of subChapters) {
        chapters.push({
          id: `${mangaId}_${ch}`,
          number: parseFloat(ch) || 0,
        });
      }
    } else if (availableChaptersDetail && availableChaptersDetail.raw) {
      const rawChapters = availableChaptersDetail.raw;
      for (const ch of rawChapters) {
        chapters.push({
          id: `${mangaId}_${ch}`,
          number: parseFloat(ch) || 0,
        });
      }
    }

    return {
      totalPages: 1,
      total: chapters.length,
      chapters: chapters,
    };
  } catch (err) {
    return {
      totalPages: 0,
      total: 0,
      chapters: [],
    };
  }
}

async function fetchChapterPages(chapterId) {
  try {
    chapterId = String(chapterId);
    let mangaId = "";
    let chapterString = chapterId;
    if (chapterId.includes("_")) {
      const parts = chapterId.split("_");
      mangaId = parts[0];
      chapterString = parts.slice(1).join("_");
    } else {
      throw new Error(
        "Invalid chapterId format for allmanga. Expected mangaId_chapterString",
      );
    }

    const variables = {
      mangaId: mangaId,
      translationType: "sub",
      chapterString: chapterString,
    };

    // Strategy 1: Direct query WITHOUT the tobeparsed alias (avoids encryption)
    let edges = [];
    try {
      const directQuery = `query ($mangaId: String!, $translationType: VaildTranslationTypeMangaEnumType!, $chapterString: String!) {
        chaptersForRead(mangaId: $mangaId, translationType: $translationType, chapterString: $chapterString) {
          edges {
            pictureUrls
            pictureUrlHead
          }
        }
      }`;

      const directRes = await global.axios.post(apiUrl, {
        query: directQuery,
        variables,
      });

      const directData = directRes.data?.data?.chaptersForRead;
      if (directData && typeof directData === "object" && directData.edges && directData.edges.length > 0) {
        edges = directData.edges;
        console.log(`[allmanga] Strategy 1 (direct query): ${edges.length} edges`);
      }
    } catch (e) {
      console.warn(`[allmanga] Strategy 1 failed: ${e.message}`);
    }

    // Strategy 2: tobeparsed alias (may return encrypted blob)
    if (edges.length === 0) {
      try {
        const encQuery = `query ($mangaId: String!, $translationType: VaildTranslationTypeMangaEnumType!, $chapterString: String!) {
          tobeparsed: chaptersForRead(mangaId: $mangaId, translationType: $translationType, chapterString: $chapterString) {
            edges {
              pictureUrls
              pictureUrlHead
            }
          }
        }`;

        const encRes = await global.axios.post(apiUrl, {
          query: encQuery,
          variables,
        });

        const payload = encRes.data?.data?.tobeparsed;
        if (payload) {
          if (typeof payload === "string") {
            // Encrypted blob — try decryption with multiple keys
            const decrypted = decryptTobeparsed(payload);
            if (decrypted) {
              edges = extractEdges(decrypted);
              console.log(`[allmanga] Strategy 2 (decrypted): ${edges.length} edges`);
            }
          } else if (typeof payload === "object") {
            // Direct JSON (not encrypted)
            edges = extractEdges(payload);
            console.log(`[allmanga] Strategy 2 (direct JSON): ${edges.length} edges`);
          }
        }
      } catch (e) {
        console.warn(`[allmanga] Strategy 2 failed: ${e.message}`);
      }
    }

    // Strategy 3: Try "raw" translation type as fallback
    if (edges.length === 0) {
      try {
        const rawVars = { ...variables, translationType: "raw" };
        const rawQuery = `query ($mangaId: String!, $translationType: VaildTranslationTypeMangaEnumType!, $chapterString: String!) {
          chaptersForRead(mangaId: $mangaId, translationType: $translationType, chapterString: $chapterString) {
            edges {
              pictureUrls
              pictureUrlHead
            }
          }
        }`;

        const rawRes = await global.axios.post(apiUrl, {
          query: rawQuery,
          variables: rawVars,
        });

        const rawData = rawRes.data?.data?.chaptersForRead;
        if (rawData && typeof rawData === "object" && rawData.edges && rawData.edges.length > 0) {
          edges = rawData.edges;
          console.log(`[allmanga] Strategy 3 (raw translation): ${edges.length} edges`);
        } else if (rawData && typeof rawData === "string") {
          const decrypted = decryptTobeparsed(rawData);
          if (decrypted) {
            edges = extractEdges(decrypted);
            console.log(`[allmanga] Strategy 3 (raw decrypted): ${edges.length} edges`);
          }
        }
      } catch (e) {
        console.warn(`[allmanga] Strategy 3 failed: ${e.message}`);
      }
    }

    // Strategy 4: Deep decrypt entire response and search recursively (Strawverse approach)
    if (edges.length === 0) {
      try {
        const deepQuery = `query ($mangaId: String!, $translationType: VaildTranslationTypeMangaEnumType!, $chapterString: String!) {
          tobeparsed: chaptersForRead(mangaId: $mangaId, translationType: $translationType, chapterString: $chapterString) {
            edges {
              pictureUrls
              pictureUrlHead
            }
          }
        }`;

        const deepRes = await global.axios.post(apiUrl, {
          query: deepQuery,
          variables,
        });

        // Deep decrypt the entire response recursively
        const fullyDecrypted = decryptJSON(deepRes.data);
        if (fullyDecrypted) {
          // Search for pictureUrls at any depth
          const found = findPictureUrls(fullyDecrypted);
          if (found && found.pictureUrls && found.pictureUrls.length > 0) {
            edges = [found];
            console.log(`[allmanga] Strategy 4 (deep search): found ${found.pictureUrls.length} pictures`);
          }
        }
      } catch (e) {
        console.warn(`[allmanga] Strategy 4 failed: ${e.message}`);
      }
    }

    // Strategy 5: Dump raw response for debugging if all strategies failed
    if (edges.length === 0) {
      try {
        const debugRes = await global.axios.post(apiUrl, {
          query: `query ($mangaId: String!, $translationType: VaildTranslationTypeMangaEnumType!, $chapterString: String!) {
            tobeparsed: chaptersForRead(mangaId: $mangaId, translationType: $translationType, chapterString: $chapterString) {
              edges {
                pictureUrls
                pictureUrlHead
              }
            }
          }`,
          variables,
        });
        const rawStr = JSON.stringify(debugRes.data).substring(0, 500);
        console.error(`[allmanga] ALL STRATEGIES FAILED. Raw response: ${rawStr}`);
      } catch (e) {
        console.error(`[allmanga] ALL STRATEGIES FAILED. Debug request also failed: ${e.message}`);
      }
    }

    const pages = buildPagesFromEdges(edges);
    console.log(`[allmanga] returning ${pages.length} pages for ${chapterId}`);
    if (pages.length === 0) {
      throw new Error("AllAnime API returned NEED_CAPTCHA or no pages found for this chapter.");
    }
    return pages;
  } catch (err) {
    console.error("fetchChapterPages error:", err.message || err);
    throw err;
  }
}

function extractEdges(obj) {
  if (!obj) return [];
  if (obj.edges && obj.edges.length > 0) return obj.edges;
  if (obj.chapterPages && obj.chapterPages.edges && obj.chapterPages.edges.length > 0) return obj.chapterPages.edges;
  if (obj.chaptersForRead && obj.chaptersForRead.edges && obj.chaptersForRead.edges.length > 0) return obj.chaptersForRead.edges;
  return [];
}

function buildPagesFromEdges(edges) {
  const pages = [];
  if (!edges || edges.length === 0) return pages;
  const edge = edges[0];
  const pictureUrls = edge.pictureUrls || [];
  for (let i = 0; i < pictureUrls.length; i++) {
    let url = pictureUrls[i].url;
    if (!url) continue;
    if (!url.startsWith("http")) {
      let head = edge.pictureUrlHead || "https://ytimgf.youtube-anime.com/";
      if (head && !head.endsWith("/")) head += "/";
      url = head + (url.startsWith("/") ? url.slice(1) : url);
    }
    pages.push({
      page: i + 1,
      img: url,
      headers: { Referer: "https://allmanga.to/" },
    });
  }
  return pages;
}

function decryptTobeparsed(blob) {
  // Try multiple known keys (AllAnime rotates them)
  const KEYS = [
    "Xot36i3lK3:v1",
    "3Au25gThRf:v1",
    "allanimenews",
    "watchanimesub",
  ];
  const data = Buffer.from(blob, "base64");
  const iv = data.slice(1, 13);
  const ciphertext = data.slice(13, data.length - 16);
  const authTag = data.slice(data.length - 16);

  for (const secret of KEYS) {
    try {
      const key = crypto.createHash("sha256").update(secret).digest();
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext, null, "utf8");
      decrypted += decipher.final("utf8");
      const parsed = JSON.parse(decrypted);
      console.log(`[allmanga] Decryption succeeded with key: ${secret}`);
      return parsed;
    } catch (e) {
      // Try next key
    }
  }
  console.error("[allmanga] All decryption keys failed");
  return null;
}

// Strawverse utility: recursively search for pictureUrls at any depth
function findPictureUrls(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const res = findPictureUrls(item);
      if (res) return res;
    }
  } else {
    if (obj.pictureUrls && Array.isArray(obj.pictureUrls)) {
      return obj;
    }
    for (const key of Object.keys(obj)) {
      const res = findPictureUrls(obj[key]);
      if (res) return res;
    }
  }
  return null;
}

// Strawverse utility: recursively decrypt any encrypted strings in a response
function decryptJSON(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => decryptJSON(item));
  } else {
    const newObj = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (
        typeof val === "string" &&
        val.length > 50 &&
        !val.includes(" ") &&
        !val.startsWith("http")
      ) {
        const decrypted = decryptTobeparsed(val);
        if (decrypted) {
          newObj[key] = decryptJSON(decrypted);
          continue;
        }
      }
      newObj[key] = typeof val === "object" ? decryptJSON(val) : val;
    }
    return newObj;
  }
}

module.exports = {
  name: "allmanga",
  version: "3.0.0",
  latestManga,
  searchManga,
  fetchMangaInfo,
  fetchChapters,
  fetchChapterPages,
};
