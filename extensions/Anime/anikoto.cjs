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
      `${baseUrl}/latest-updated?page=${page}`,
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
  let suffix = id.endsWith("dub") ? "dub" : id.endsWith("sub") ? "sub" : "both";
  id = id.replace(/-(dub|sub|both)$/, "");

  const animeInfo = {
    id: `${id}-${suffix}`,
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
    animeInfo.subOrDub = suffix;

    return animeInfo;
  } catch (error) {
    console.error("Error fetching data from AnikotoTV:", error);
    throw error;
  }
}

async function fetchEpisode(dataId, page = 1) {
  try {
    const url = `${baseUrl}/ajax/episode/list/${dataId}`;
    const { data } = await global.axios.get(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const $ = cheerio.load(data.result);
    let episodes = [];

    $("a[data-id][data-ids], .ep-item, li a").each((i, el) => {
      const epNum = $(el).attr("data-num");
      const epId = $(el).attr("data-id");
      const dataIds = $(el).attr("data-ids");
      const title =
        $(el).attr("title") ||
        $(el).find(".d-title").text().trim() ||
        `Episode ${epNum}`;

      if (epId && dataIds) {
        const hasSub = $(el).attr("data-sub") === "1";
        const hasDub = $(el).attr("data-dub") === "1";
        let lang = "sub";
        if (hasSub && hasDub) {
          lang = "both";
        } else if (hasDub) {
          lang = "dub";
        }

        episodes.push({
          id: `${epId}|${dataIds}`,
          number: parseFloat(epNum),
          title: title,
          duration: "Unknown",
          lang: lang,
        });
      }
    });

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

async function processServer(server) {
  if (!server || !server.linkId) return null;
  try {
    const linkRes = await global.axios.get(
      `${baseUrl}/ajax/server?get=${server.linkId}`,
      {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      },
    );

    const iframeUrl = linkRes.data?.result?.url;
    if (!iframeUrl) return null;

    const iframeRes = await global.axios.get(iframeUrl, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Referer: baseUrl,
      },
    });

    const $iframe = cheerio.load(iframeRes.data);
    const playerDbId = $iframe("#megaplay-player").attr("data-id");
    if (!playerDbId) return null;

    const typeMatch =
      iframeRes.data.match(/type\s*:\s*'([^']+)'/) ||
      iframeUrl.match(/\/stream\/[^\/]+\/([^\/\?]+)/);
    const type = typeMatch ? typeMatch[1] : "";

    const ciduMatch = iframeRes.data.match(/cidu\s*:\s*'([^']+)'/);
    const cidu = ciduMatch ? ciduMatch[1] : "";

    const domainName = new URL(iframeUrl).origin;
    const playerReferer = domainName + "/";
    const sourcesRes = await global.axios.get(
      `${domainName}/stream/getSources?id=${playerDbId}${type ? `&type=${encodeURIComponent(type)}` : ""}${cidu ? `&cidu=${encodeURIComponent(cidu)}` : ""}`,
      {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Referer: playerReferer,
        },
      },
    );

    if (sourcesRes.data && sourcesRes.data.sources) {
      const m3u8Url =
        sourcesRes.data.sources.file ||
        (Array.isArray(sourcesRes.data.sources)
          ? sourcesRes.data.sources[0]?.file
          : null);
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

        return {
          url: m3u8Url,
          isM3U8: true,
          quality: server.name || "auto",
          isDub: server.type === "dub",
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

async function fetchEpisodeSources(episodeIdStr) {
  try {
    const isBoth = episodeIdStr.endsWith("both");
    const isDub = episodeIdStr.endsWith("dub") ? true : false;

    let cleanStr = episodeIdStr.replace(/-(dub|sub|both)$/, "");
    const parts = cleanStr.split("|");
    const epId = parts[0];
    const dataIds = parts[1];

    const serverUrl = `${baseUrl}/ajax/server/list?servers=${dataIds}`;
    const serverRes = await global.axios.get(serverUrl, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const $ = cheerio.load(serverRes.data.result);

    let iSource = {};
    if (!isBoth) iSource.sources = [];
    if (isBoth) iSource = { dub: { sources: [] }, sub: { sources: [] } };

    let selector = ".type[data-type='sub'] li, .type[data-type='dub'] li";
    if (!isBoth) {
      selector = isDub
        ? ".type[data-type='dub'] li"
        : ".type[data-type='sub'] li";
    }

    const servers = [];
    $(selector).each((i, el) => {
      const type = $(el).closest(".type").attr("data-type");
      servers.push({
        type: type,
        linkId: $(el).attr("data-link-id"),
        name: $(el).text().trim(),
      });
    });

    const results = await Promise.all(
      servers.map((s) =>
        Promise.race([
          processServer(s),
          new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
        ]),
      ),
    );
    const validResults = results.filter(Boolean);
    const anySubtitles = validResults.find(
      (r) => r.subtitles && r.subtitles.length > 0,
    )?.subtitles;

    if (isBoth) {
      const dubResults = validResults.filter((r) => r.isDub);
      const subResults = validResults.filter((r) => !r.isDub);

      iSource.dub.sources = dubResults.map(({ subtitles, ...rest }) => rest);
      iSource.sub.sources = subResults.map(({ subtitles, ...rest }) => rest);

      const dubSubtitles = dubResults.find(
        (r) => r.subtitles && r.subtitles.length > 0,
      )?.subtitles;
      const subSubtitles = subResults.find(
        (r) => r.subtitles && r.subtitles.length > 0,
      )?.subtitles;

      if (dubSubtitles || subSubtitles || anySubtitles) {
        iSource.dub.subtitles = dubSubtitles || subSubtitles || anySubtitles;
        iSource.sub.subtitles = subSubtitles || dubSubtitles || anySubtitles;
      }
      if (anySubtitles) {
        iSource.subtitles = anySubtitles;
      }
    } else {
      iSource.sources = validResults.map(({ subtitles, ...rest }) => rest);
      if (anySubtitles) {
        iSource.subtitles = anySubtitles;
      }
    }

    return iSource;
  } catch (err) {
    console.error("Error fetching data from AnikotoTV:", err);
    return { sources: [] };
  }
}

module.exports = {
  name: "anikoto",
  version: "4.0.6",
  SearchAnime,
  AnimeInfo,
  fetchEpisodeSources,
  fetchRecentEpisodes,
  fetchEpisode,
};
