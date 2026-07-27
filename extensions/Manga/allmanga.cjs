/**
 * StrawVerse Extension - AllManga Scraper
 * Copyright (C) 2026 TheYogMehta
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * DISCLAIMER: This extension is intended for research, educational,
 * and developer testing purposes only. It functions as a client-side parser
 * of publicly available web pages. The developers do not host or distribute
 * any copyrighted media. Users are responsible for compliance with the terms of
 * service of the target website.
 */

const crypto = require("crypto");
const cheerio = require("cheerio");

const baseUrl = "https://allmanga.to/manga";
const apiUrl = "https://api.allanime.day/api";
const THUMBNAIL_CDN = "https://wp.youtube-anime.com/aln.youtube-anime.com/";

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
      current_page: page,
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
      TotalPages: 1,
      total: chapters.length,
      Chapters: chapters,
    };
  } catch (err) {
    return {
      TotalPages: 0,
      total: 0,
      Chapters: [],
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
      chapterString = parts[1];
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

    const query = `query ($mangaId: String!, $translationType: VaildTranslationTypeMangaEnumType!, $chapterString: String!) {
      tobeparsed: chaptersForRead(mangaId: $mangaId, translationType: $translationType, chapterString: $chapterString) {
        edges {
          pictureUrls
          pictureUrlHead
        }
      }
    }`;

    const response = await global.axios.post(apiUrl, {
      query,
      variables,
    });

    let edges = [];

    const payload = response.data?.data?.tobeparsed;
    if (payload) {
      const decrypted =
        typeof payload === "string" ? decryptTobeparsed(payload) : payload;
      if (decrypted) {
        if (
          decrypted.chapterPages &&
          decrypted.chapterPages.edges &&
          decrypted.chapterPages.edges.length > 0
        ) {
          edges = decrypted.chapterPages.edges;
        } else if (
          decrypted.chaptersForRead &&
          decrypted.chaptersForRead.edges &&
          decrypted.chaptersForRead.edges.length > 0
        ) {
          edges = decrypted.chaptersForRead.edges;
        } else if (decrypted.edges && decrypted.edges.length > 0) {
          edges = decrypted.edges;
        }
      }
    }

    const pages = [];
    if (edges && edges.length > 0) {
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
        });
      }
    }

    return pages;
  } catch (err) {
    console.error("fetchChapterPages error:", err);
    return [];
  }
}

function decryptTobeparsed(blob) {
  try {
    const data = Buffer.from(blob, "base64");
    const iv = data.slice(1, 13);
    const ciphertext = data.slice(13, data.length - 16);
    const authTag = data.slice(data.length - 16);

    const key = crypto.createHash("sha256").update("Xot36i3lK3:v1").digest();

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, null, "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (e) {
    console.error("decryptTobeparsed decryption failed:", e.message);
    return null;
  }
}

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
          console.log(`CDP: Successfully decrypted key "${key}"!`);
          newObj[key] = decryptJSON(decrypted);
          continue;
        }
      }
      newObj[key] = decryptJSON(val);
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
