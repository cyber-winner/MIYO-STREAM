/**
 * StrawVerse Extension - Anikoto Scraper
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

const cheerio = require("cheerio");
const crypto = require("crypto");

const baseUrl = "https://anikototv.to";

function parsePagination($, defaultPage) {
  let totalPages = 1;
  $(".pagination a").each((i, el) => {
    const href = $(el).attr("href");
    if (href) {
      const match = href.match(/page=(\d+)/);
      if (match) {
        const pageNum = parseInt(match[1]);
        if (pageNum > totalPages) {
          totalPages = pageNum;
        }
      }
    }
  });

  let hasNextPage = false;
  $(".pagination a").each((i, el) => {
    const rel = $(el).attr("rel");
    if (rel === "next") {
      hasNextPage = true;
    }
  });

  const activePageText = $(
    ".pagination li.active, .pagination li.page-item.active",
  )
    .text()
    .trim();
  const currentPage = parseInt(activePageText) || defaultPage || 1;

  return {
    currentPage,
    hasNextPage,
    totalPages,
  };
}

async function SearchAnime(query, filters = {}) {
  try {
    const page = filters?.page || 1;
    const { data: html } = await global.axios.get(
      `${baseUrl}/search?keyword=${encodeURIComponent(query)}&page=${page}`,
    );
    const $ = cheerio.load(html);
    const results = [];

    $("div.item").each((i, el) => {
      const aTag = $(el).find(".name.d-title");
      const title =
        aTag.text().trim() ||
        aTag.attr("data-jp") ||
        aTag.attr("title") ||
        $(el).find(".name.d-title").text().trim() ||
        $(el).find(".title").text().trim();
      let href = aTag.attr("href");
      if (!href) return;
      const match = href.match(/\/watch\/([^\/]+)/);
      if (!match) return;
      const id = match[1];

      const image =
        $(el).find(".ani.poster img").attr("src") ||
        $(el).find("img").attr("src");

      results.push({
        id: id,
        title: title,
        image: image || null,
      });
    });

    const pagination = parsePagination($, page);

    return {
      currentPage: pagination.currentPage,
      hasNextPage: pagination.hasNextPage,
      totalPages: pagination.totalPages,
      results: results,
    };
  } catch (err) {
    throw new Error(err.message);
  }
}

async function fetchRecentEpisodes(filters = {}) {
  try {
    const page = filters?.page || 1;
    const { data: html } = await global.axios.get(
      `${baseUrl}/filter?keyword=&type=Latest+Updated&ep_min=&ep_max=&page=${page}&sort=latest-updated`,
    );
    const $ = cheerio.load(html);
    const results = [];

    $(".item").each((i, el) => {
      const aTag = $(el).find(".name.d-title").length
        ? $(el).find(".name.d-title").first()
        : $(el).find("a").last();
      const imgTag = $(el).find("img");

      const title =
        $(el).find(".name.d-title").text().trim() ||
        $(el).find(".title").text().trim() ||
        imgTag.attr("title") ||
        imgTag.attr("alt") ||
        aTag.attr("title") ||
        aTag.attr("data-jp") ||
        aTag
          .text()
          .trim()
          .replace(/TV\s*Sub\s*Dub/i, "")
          .trim();

      let href = $(el).find("a").first().attr("href") || aTag.attr("href");

      if (!href) return;
      const match = href.match(/\/watch\/([^\/]+)/);
      if (!match) return;
      const id = match[1];

      const image =
        $(el).find(".ani.poster img").attr("src") ||
        $(el).find("img").attr("src");

      results.push({
        id: id,
        title: title,
        image: image || null,
      });
    });

    const pagination = parsePagination($, page);

    return {
      currentPage: pagination.currentPage,
      hasNextPage: pagination.hasNextPage,
      totalPages: pagination.totalPages,
      results: results,
    };
  } catch (err) {
    throw new Error(err.message);
  }
}

async function AnimeInfo(id) {
  const animeInfo = {
    id: id,
    title: "",
  };

  try {
    const { data: html } = await global.axios.get(`${baseUrl}/watch/${id}`);
    const $ = cheerio.load(html);

    const dataId = $("#watch-main").attr("data-id");

    animeInfo.title =
      $('h1[itemprop="name"]').text().trim() ||
      $(".title").first().text().trim() ||
      id;
    animeInfo.image =
      $('img[itemprop="image"]').attr("src") ||
      $(".ani.poster img").attr("src") ||
      null;
    animeInfo.description =
      $(".synopsis").text().trim() || $(".description").text().trim() || "";

    const genres = [];
    $(".genre a").each((i, el) => {
      genres.push($(el).text().trim());
    });
    animeInfo.genres = genres;
    animeInfo.status = "Unknown";

    $(".info .item").each((i, el) => {
      const text = $(el).text();
      if (text.includes("Status:")) {
        const status = $(el).find(".name").text().trim();
        if (status.includes("Currently Airing")) animeInfo.status = "Ongoing";
        else if (status.includes("Finished Airing"))
          animeInfo.status = "Completed";
      }
    });
    animeInfo.dataId = dataId;

    return animeInfo;
  } catch (error) {
    console.error("Error fetching data from AnikotoTV:", error);
    throw error;
  }
}

async function fetchEpisode(dataId, page = 1) {
  try {
    let numericId = dataId;
    if (!/^\d+$/.test(String(dataId))) {
      try {
        const { data: watchHtml } = await global.axios.get(
          `${baseUrl}/watch/${dataId}`,
        );
        const $w = cheerio.load(watchHtml);
        numericId =
          $w("#watch-main").attr("data-id") ||
          $w("[data-id]").attr("data-id") ||
          $w("#wrapper").attr("data-id");
      } catch (e) {}
    }

    if (!numericId) {
      return { episodes: [], totalPages: 0, total: 0, currentPage: page };
    }

    const url = `${baseUrl}/ajax/episode/list/${numericId}`;
    const { data } = await global.axios.get(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const $ = cheerio.load(data.result || "");
    let episodes = [];

    $("a[data-id][data-ids], .ep-item, li a, .ssl-item, a.item").each(
      (i, el) => {
        const epNum =
          $(el).attr("data-num") || $(el).attr("data-number") || String(i + 1);
        const epId = $(el).attr("data-id");
        const dataIds = $(el).attr("data-ids");
        const title =
          $(el).attr("title") ||
          $(el).find(".d-title").text().trim() ||
          `Episode ${epNum}`;

        if (epId && dataIds) {
          const langs = [];
          if ($(el).attr("data-sub") === "1") langs.push("sub");
          if ($(el).attr("data-dub") === "1") langs.push("dub");

          episodes.push({
            id: `${epId}|${dataIds}`,
            number: parseFloat(epNum),
            title: title,
            duration: "Unknown",
            langs,
          });
        }
      },
    );

    return {
      episodes: episodes,
      totalPages: 1,
      total: episodes.length,
      currentPage: 1,
    };
  } catch (err) {
    return { episodes: [], totalPages: 0, total: 0, currentPage: page };
  }
}

function decryptMegaplayEnc(encStr) {
  if (!encStr || typeof encStr !== "string") return null;
  try {
    const key = Buffer.alloc(32);
    Buffer.from("i?LMTAx0Q6,:}50U", "utf8").copy(key, 0, 0, 16);
    const iv = Buffer.alloc(16);
    Buffer.from("W0;27ToaUpl_P%'c", "utf8").copy(iv, 0, 0, 16);
    let base64 = encStr.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) {
      base64 += "====".slice(pad);
    }
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(base64, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}

async function processServer(server) {
  if (!server || !server.linkId) return null;
  try {
    const linkRes = await global.axios.get(
      `${baseUrl}/ajax/server?get=${server.linkId}`,
      {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
        timeout: 7000,
      },
    );

    let iframeUrl =
      linkRes.data?.result?.url ||
      linkRes.data?.url ||
      (typeof linkRes.data?.result === "string" ? linkRes.data.result : null);
    if (!iframeUrl && typeof linkRes.data?.result === "string") {
      const match = linkRes.data.result.match(/src=["']([^"']+)["']/);
      if (match) iframeUrl = match[1];
    }
    if (!iframeUrl || typeof iframeUrl !== "string") return null;
    if (iframeUrl.startsWith("//")) iframeUrl = "https:" + iframeUrl;

    const iframeRes = await global.axios.get(iframeUrl, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Referer: baseUrl,
      },
      timeout: 7000,
    });

    const $iframe = cheerio.load(iframeRes.data);
    let playerDbId =
      $iframe("#megaplay-player").attr("data-id") ||
      $iframe("[data-id]").attr("data-id");
    if (!playerDbId) {
      const match = iframeRes.data.match(/data-id=["']([^"']+)["']/);
      if (match) playerDbId = match[1];
    }
    if (!playerDbId) return null;

    const typeMatch =
      iframeRes.data.match(/type\s*:\s*'([^']+)'/) ||
      iframeUrl.match(/\/stream\/[^\/]+\/([^\/\?]+)/);
    const type = typeMatch ? typeMatch[1] : "";

    const ciduMatch = iframeRes.data.match(/cidu\s*:\s*'([^']+)'/);
    const cidu = ciduMatch ? ciduMatch[1] : "";

    let sParam = "";
    try {
      sParam = new URL(iframeUrl).searchParams.get("s") || "";
    } catch (_) {}
    if (!sParam) sParam = "bcdn";

    const domainName = new URL(iframeUrl).origin;
    const playerReferer = domainName + "/";
    const sourcesRes = await global.axios.get(
      `${domainName}/stream/getSources?id=${playerDbId}${type ? `&type=${encodeURIComponent(type)}` : ""}${cidu ? `&cidu=${encodeURIComponent(cidu)}` : ""}${sParam ? `&s=${encodeURIComponent(sParam)}` : ""}`,
      {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Referer: playerReferer,
        },
        timeout: 7000,
      },
    );

    let rawSrc = sourcesRes.data?.sources;
    if (!rawSrc && sourcesRes.data?.enc) {
      rawSrc = decryptMegaplayEnc(sourcesRes.data.enc);
    }

    if (rawSrc) {
      let m3u8Url =
        typeof rawSrc === "string"
          ? rawSrc
          : rawSrc.file ||
            rawSrc.url ||
            (Array.isArray(rawSrc)
              ? rawSrc[0]?.file ||
                rawSrc[0]?.url ||
                (typeof rawSrc[0] === "string" ? rawSrc[0] : null)
              : null);
      if (m3u8Url && m3u8Url.includes("cdn.imgnex.top")) {
        m3u8Url = m3u8Url.replace("://cdn.imgnex.top", "://ncdn.imgnex.top");
      }
      if (m3u8Url) {
        try {
          const cdnDomain = new URL(m3u8Url).hostname;
          global.setDynamicReferer(cdnDomain, playerReferer);
          global.setFallbackReferer(playerReferer);
        } catch (e) {}

        const subtitles = (sourcesRes.data.tracks || [])
          .filter(
            (t) => t.file && (!t.kind || t.kind.toLowerCase() !== "thumbnails"),
          )
          .map((t) => {
            let sUrl = t.file;
            if (sUrl.startsWith("//")) {
              sUrl = "https:" + sUrl;
            } else if (
              !sUrl.startsWith("http://") &&
              !sUrl.startsWith("https://")
            ) {
              try {
                sUrl = new URL(sUrl, iframeUrl).href;
              } catch (e) {}
            }
            return {
              url: sUrl,
              lang: t.label || t.language || "English",
            };
          });

        if (Array.isArray(subtitles) && global.setDynamicReferer) {
          for (const s of subtitles) {
            try {
              if (s.url) {
                global.setDynamicReferer(
                  new URL(s.url).hostname,
                  playerReferer,
                );
              }
            } catch (_) {}
          }
        }

        return {
          url: m3u8Url,
          isM3U8: true,
          quality: server.name || "auto",
          isDub: server.type === "dub",
          isHsub: server.type === "hsub",
          type: server.type,
          headers: { Referer: playerReferer },
          subtitles: subtitles,
        };
      }
    }
  } catch (err) {
    console.error(`Failed to process server ${server.name}:`, err.message);
  }
  return null;
}

async function fetchEpisodeSources(episodeIdStr, category = null) {
  try {
    const parts = episodeIdStr.split("|");
    const epId = parts[0];
    const dataIds = parts[1];

    const serverUrl = `${baseUrl}/ajax/server/list?servers=${dataIds}`;
    const serverRes = await global.axios.get(serverUrl, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
      timeout: 7000,
    });

    const $ = cheerio.load(serverRes.data.result);

    const servers = [];
    $(
      ".psps-links .item, .psps-links li, .type-server li, [data-type] li, li[data-link-id], li[data-id], .server-item",
    ).each((i, el) => {
      const parentWithType = $(el).closest("[data-type]");
      let type =
        $(el).attr("data-type") ||
        (parentWithType.length ? parentWithType.attr("data-type") : "");
      if (!type) {
        const parentClass =
          ($(el).attr("class") || "") +
          " " +
          ($(el).parent().attr("class") || "") +
          " " +
          ($(el).closest("[class]").attr("class") || "");
        if (parentClass.includes("dub")) type = "dub";
        else if (parentClass.includes("hsub")) type = "hsub";
        else if (parentClass.includes("sub")) type = "sub";
      }
      const linkId = $(el).attr("data-link-id") || $(el).attr("data-id");
      const name = $(el).text().trim() || $(el).find("a").text().trim();
      if (linkId) {
        servers.push({
          type: (type || "sub").toLowerCase(),
          linkId: linkId,
          name: name || "Server",
        });
      }
    });

    let targetServers = servers;
    if (category) {
      const catLower = category.toLowerCase();
      targetServers = servers.filter((s) => {
        const typeLower = (s.type || "").toLowerCase();
        if (catLower === "hsub" || catLower === "hardsub") {
          return typeLower === "hsub" || typeLower === "hardsub";
        } else if (catLower === "sub" || catLower === "softsub") {
          return typeLower === "sub" || typeLower === "softsub";
        } else if (catLower === "dub") {
          return typeLower === "dub";
        }
        return typeLower === catLower;
      });

      targetServers.sort((a, b) => {
        const aName = (a.name || "").toLowerCase();
        const bName = (b.name || "").toLowerCase();
        const getServerScore = (n) => {
          if (
            n.includes("hd-1") ||
            n.includes("megacloud") ||
            n.includes("hd-2") ||
            n.includes("megaplay") ||
            n.includes("hd 1") ||
            n.includes("hd 2")
          )
            return 10;
          if (n.includes("vidplay")) return 8;
          if (
            n.includes("vidstream-1") ||
            n.includes("vidstream 1") ||
            n === "vidstream"
          )
            return 5;
          if (n.includes("vidstream-2") || n.includes("vidstream 2")) return 1;
          if (n.includes("vidstream")) return 2;
          return 3;
        };
        return getServerScore(bName) - getServerScore(aName);
      });
    }

    const requestedCategory = (category || "sub").toLowerCase();
    if (targetServers.length === 0) {
      return { sources: [], subtitles: [] };
    }

    const sources = targetServers.map((s) => ({
      quality: s.name,
      name: s.name,
      linkId: s.linkId,
      lang: s.type || requestedCategory,
      type: s.type || requestedCategory,
      isDub: (s.type || requestedCategory) === "dub",
      isSub: (s.type || requestedCategory) === "sub",
      isHsub: (s.type || requestedCategory) === "hsub",
      isUnresolved: true,
      rawServer: s,
    }));

    return {
      sources,
      subtitles: [],
    };
  } catch (err) {
    console.error("Error fetching data from AnikotoTV:", err);
    return { sources: [], subtitles: [] };
  }
}

module.exports = {
  name: "anikoto",
  version: "5.0.3",
  SearchAnime,
  AnimeInfo,
  fetchEpisodeSources,
  processServer,
  fetchRecentEpisodes,
  fetchEpisode,
};
