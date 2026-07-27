/**
 * StrawVerse Extension - AniNeko Scraper
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

const baseUrl = "https://anineko.to";

function parsePagination($, defaultPage) {
  let totalPages = 1;
  $(".pagination a.page-link").each((i, el) => {
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
  $(".pagination li.next, .pagination li.page-item.next").each((i, el) => {
    hasNextPage = true;
  });

  const activeText = $(".pagination li.active a.page-link").text().trim();
  const currentPage = parseInt(activeText) || defaultPage || 1;

  return {
    currentPage,
    hasNextPage,
    totalPages,
  };
}

// Anime Search
async function SearchAnime(query, filters = {}) {
  try {
    const page = filters?.page || 1;
    const { data: html } = await global.axios.get(
      `${baseUrl}/browser?keyword=${encodeURIComponent(query)}&page=${page}`,
    );
    const $ = cheerio.load(html);
    const results = [];

    $("article.nv-anime-card").each((i, el) => {
      const titleEl = $(el).find("h3.nv-anime-title a");
      const title = titleEl.text().trim();
      let href = titleEl.attr("href") || $(el).find("a").first().attr("href");
      if (!href) return;

      const match = href.match(/\/watch\/([^\/]+)/);
      if (!match) return;
      const id = match[1];

      const image =
        $(el).find(".nv-anime-thumb img").attr("src") ||
        $(el).find("img").attr("src") ||
        null;

      results.push({
        id,
        title,
        image,
      });
    });

    const pagination = parsePagination($, page);

    return {
      currentPage: pagination.currentPage,
      hasNextPage: pagination.hasNextPage,
      totalPages: pagination.totalPages,
      results,
    };
  } catch (err) {
    throw new Error(err.message);
  }
}

// Recent Episodes
async function fetchRecentEpisodes(filters = {}) {
  try {
    const page = filters?.page || 1;
    const { data: html } = await global.axios.get(
      `${baseUrl}/updates?page=${page}`,
    );
    const $ = cheerio.load(html);
    const results = [];

    $("article.nv-anime-card").each((i, el) => {
      const titleEl = $(el).find("h3.nv-anime-title a");
      const title = titleEl.text().trim();
      let href = titleEl.attr("href") || $(el).find("a").first().attr("href");
      if (!href) return;

      const match = href.match(/\/watch\/([^\/]+)/);
      if (!match) return;
      const id = match[1];

      const image =
        $(el).find(".nv-anime-thumb img").attr("src") ||
        $(el).find("img").attr("src") ||
        null;

      results.push({
        id,
        title,
        image,
      });
    });

    const pagination = parsePagination($, page);

    return {
      currentPage: pagination.currentPage,
      hasNextPage: pagination.hasNextPage,
      totalPages: pagination.totalPages,
      results,
    };
  } catch (err) {
    throw new Error(err.message);
  }
}

// Anime Info
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

    animeInfo.title = $("h1").first().text().trim() || id;
    animeInfo.image = $(".nv-info-poster img").attr("src") || null;
    animeInfo.description =
      $(".nv-info-desc").text().trim() ||
      $(".nv-info-synopsis").text().trim() ||
      "";

    const genres = [];
    $(".nv-info-tags span").each((i, el) => {
      const text = $(el).text().trim();
      if (
        text &&
        !["SUB", "DUB", "Hardsub", "HD", "HSUB"].includes(text) &&
        !text.match(/^\d{4}$/) &&
        ![
          "Currently Airing",
          "Finished Airing",
          "Not yet aired",
          "TV",
          "Movie",
          "OVA",
          "ONA",
          "Special",
          "Music",
          "TV_SHORT",
        ].includes(text)
      ) {
        genres.push(text);
      }
    });
    animeInfo.genres = genres;
    animeInfo.status = "Unknown";
    const statusText = $(".nv-info-tags span, .nv-pill").text();
    if (statusText.includes("Currently Airing")) {
      animeInfo.status = "Ongoing";
    } else if (statusText.includes("Finished Airing")) {
      animeInfo.status = "Completed";
    }
    const typeEl = $(".nv-info-stats div").first().find("strong").text().trim();
    animeInfo.type = typeEl || "TV";

    animeInfo.dataId = id;
    animeInfo.subOrDub = suffix;

    return animeInfo;
  } catch (error) {
    console.error("Error fetching data from AniNeko:", error);
    throw error;
  }
}

// Fetch Episodes
async function fetchEpisode(id, page = 1) {
  try {
    id = id.replace(/-(dub|sub|both)$/, "");

    const { data: html } = await global.axios.get(`${baseUrl}/watch/${id}`);
    const $ = cheerio.load(html);
    let episodes = [];

    $("article.nv-info-episode-item").each((i, el) => {
      const mainLink = $(el).find("a.nv-info-episode-main");
      const href = mainLink.attr("href") || "";
      const epMatch = href.match(/\/ep-(\d+)/);
      const epNum = epMatch ? parseInt(epMatch[1]) : i + 1;

      const titleStrong = mainLink.find("strong").text().trim();
      const titleSpan = mainLink.find("span").text().trim();
      const title = titleSpan || titleStrong || `Episode ${epNum}`;

      const badges = $(el)
        .find(".nv-info-episode-badges span")
        .map((j, badge) => $(badge).text().trim().toUpperCase())
        .get();

      const hasSub = badges.includes("SUB");
      const hasDub = badges.includes("DUB");
      const hasHsub = badges.includes("HSUB") || badges.includes("HARDSUB");

      let lang = "sub";
      if (hasSub && hasDub) {
        lang = "both";
      } else if (hasDub) {
        lang = "dub";
      }

      const langs = [];
      if (hasSub) langs.push("sub");
      if (hasHsub) langs.push("hsub");
      if (hasDub) langs.push("dub");
      const watchPathMatch = href.match(/\/watch\/(.+)$/);
      const epSlug = watchPathMatch ? watchPathMatch[1] : `${id}/ep-${epNum}`;

      episodes.push({
        id: epSlug,
        number: epNum,
        title,
        duration: "Unknown",
        lang,
        langs,
        hasHsub,
      });
    });

    return {
      episodes,
      totalPages: 1,
      total: episodes.length,
      currentPage: 1,
    };
  } catch (err) {
    return { episodes: [], totalPages: 0, total: 0, currentPage: page };
  }
}

// Fetch Episode Sources
async function fetchEpisodeSources(episodeId) {
  try {
    let reqLang = "sub";
    let cleanId = episodeId;
    const isBoth = episodeId.endsWith("-both");

    const suffixMatch = episodeId.match(/-(sub|dub|hsub|both)$/);
    if (suffixMatch) {
      const suffix = suffixMatch[1];
      reqLang = suffix;
      cleanId = episodeId.substring(0, episodeId.lastIndexOf("-" + suffix));
    }

    const { data: html } = await global.axios.get(
      `${baseUrl}/watch/${cleanId}`,
    );
    const $ = cheerio.load(html);

    let iSource = {};
    if (!isBoth) iSource.sources = [];
    if (isBoth) iSource = { dub: { sources: [] }, sub: { sources: [] } };

    const servers = [];

    $(".lang-group").each((i, panel) => {
      const panelType = $(panel).attr("data-id");

      $(panel)
        .find("button.server-video")
        .each((j, btn) => {
          const videoUrl = $(btn).attr("data-video");
          const cloned = $(btn).clone();
          cloned.find("span").remove();
          const serverName = cloned.text().trim() || "Server";

          if (videoUrl) {
            servers.push({
              url: videoUrl,
              name: serverName,
              type: panelType,
              isDefault: $(btn).hasClass("default"),
            });
          }
        });
    });

    let serversToProcess;
    if (reqLang === "both") {
      serversToProcess = servers;
    } else {
      serversToProcess = servers.filter((s) => s.type === reqLang);
    }

    const results = await Promise.all(
      serversToProcess.map((server) =>
        Promise.race([
          (async () => {
            try {
              return await processEmbedServer(server);
            } catch (err) {
              console.error(
                `Failed to process server ${server.name}:`,
                err.message,
              );
              return null;
            }
          })(),
          new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
        ]),
      ),
    );

    const validResults = results.filter(Boolean);

    if (isBoth) {
      const dubResults = validResults.filter((r) => r.isDub);
      const subResults = validResults.filter((r) => !r.isDub);

      iSource.dub.sources = dubResults.map(({ subtitles, ...rest }) => rest);
      iSource.sub.sources = subResults.map(({ subtitles, ...rest }) => rest);

      const anySubtitles = validResults.find(
        (r) => r.subtitles && r.subtitles.length > 0,
      )?.subtitles;

      if (anySubtitles) {
        iSource.dub.subtitles = anySubtitles;
        iSource.sub.subtitles = anySubtitles;
        iSource.subtitles = anySubtitles;
      }
    } else {
      iSource.sources = validResults.map(({ subtitles, ...rest }) => rest);

      const anySubtitles = validResults.find(
        (r) => r.subtitles && r.subtitles.length > 0,
      )?.subtitles;
      if (anySubtitles) {
        iSource.subtitles = anySubtitles;
      }
    }

    return iSource;
  } catch (err) {
    console.error("Error fetching data from AniNeko:", err);
    return { sources: [] };
  }
}

// Process an embed server URL to extract the actual video source
async function processEmbedServer(server) {
  try {
    const embedUrl = server.url;
    let typeLabel = server.type ? server.type.toUpperCase() : "";
    if (server.type === "sub") typeLabel = "Sub";
    if (server.type === "hsub") typeLabel = "HSub";
    if (server.type === "dub") typeLabel = "Dub";
    const qualityLabel = `${server.name} ${typeLabel}`;
    let subtitles = [];
    try {
      const urlObj = new URL(embedUrl);
      const subParam = urlObj.searchParams.get("sub");
      const captionParam = urlObj.searchParams.get("caption_1");
      const c1FileParam = urlObj.searchParams.get("c1_file");
      let subUrl = subParam || captionParam || c1FileParam;
      if (subUrl) {
        if (subUrl.startsWith("//")) {
          subUrl = "https:" + subUrl;
        } else if (
          !subUrl.startsWith("http://") &&
          !subUrl.startsWith("https://")
        ) {
          try {
            subUrl = new URL(subUrl, embedUrl).href;
          } catch (e) {}
        }
        subtitles.push({
          url: subUrl,
          lang: "English",
        });
      }
    } catch (e) {}

    const { data: embedHtml } = await global.axios.get(embedUrl, {
      headers: {
        Referer: `${baseUrl}/`,
      },
    });

    try {
      const tracksRegex = /tracks\s*[:=]\s*(\[[^\]]+\])/i;
      const tracksMatch = embedHtml.match(tracksRegex);
      if (tracksMatch) {
        const arrayStr = tracksMatch[1];
        const objRegex = /\{([^}]+)\}/g;
        let objMatch;
        while ((objMatch = objRegex.exec(arrayStr)) !== null) {
          const objContent = objMatch[1];
          const fileM = objContent.match(
            /['"]?file['"]?\s*:\s*['"]([^'"]+)['"]/,
          );
          if (fileM) {
            let sUrl = fileM[1];
            const labelM = objContent.match(
              /['"]?label['"]?\s*:\s*['"]([^'"]+)['"]/,
            );
            const kindM = objContent.match(
              /['"]?kind['"]?\s*:\s*['"]([^'"]+)['"]/,
            );
            const langM = objContent.match(
              /['"]?(?:language|lang)['"]?\s*:\s*['"]([^'"]+)['"]/,
            );

            const kind = kindM ? kindM[1].toLowerCase() : "";
            if (!kind || kind !== "thumbnails") {
              if (sUrl.startsWith("//")) {
                sUrl = "https:" + sUrl;
              } else if (
                !sUrl.startsWith("http://") &&
                !sUrl.startsWith("https://")
              ) {
                try {
                  sUrl = new URL(sUrl, embedUrl).href;
                } catch (e) {}
              }
              subtitles.push({
                url: sUrl,
                lang: labelM ? labelM[1] : langM ? langM[1] : "English",
              });
            }
          }
        }
      }

      if (subtitles.length === 0) {
        const subFileRegex =
          /["']?file["']?\s*:\s*["']([^"']+\.(?:vtt|srt)[^"']*)["']/gi;
        let subMatch;
        while ((subMatch = subFileRegex.exec(embedHtml)) !== null) {
          let sUrl = subMatch[1];
          if (sUrl.startsWith("//")) {
            sUrl = "https:" + sUrl;
          } else if (
            !sUrl.startsWith("http://") &&
            !sUrl.startsWith("https://")
          ) {
            try {
              sUrl = new URL(sUrl, embedUrl).href;
            } catch (e) {}
          }
          subtitles.push({ url: sUrl, lang: "English" });
        }
      }
    } catch (e) {}
    let m3u8Match = embedHtml.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
    if (!m3u8Match) {
      const srcMatch = embedHtml.match(
        /src\s*=\s*["']([^"']*\.m3u8[^"']*)["']/,
      );
      if (srcMatch) {
        m3u8Match = [srcMatch[1]];
      }
    }
    if (!m3u8Match) {
      const evalMatch = /(eval)(\(f.*?)(<\/script>)/s.exec(embedHtml);
      if (evalMatch) {
        try {
          const unpacked = eval(evalMatch[2].replace("eval", ""));
          m3u8Match = unpacked.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
        } catch (e) {}
      }
    }
    if (!m3u8Match) {
      const fileMatch = embedHtml.match(
        /["']?file["']?\s*:\s*["']([^"']+\.m3u8[^"']*)["']/,
      );
      if (fileMatch) {
        m3u8Match = [fileMatch[1]];
      }
    }
    if (!m3u8Match) {
      const sourcesMatch = embedHtml.match(
        /sources\s*[:=]\s*\[\s*\{[^}]*["']?file["']?\s*:\s*["']([^"']+)["']/,
      );
      if (sourcesMatch) {
        m3u8Match = [sourcesMatch[1]];
      }
    }

    if (m3u8Match) {
      const m3u8Url = m3u8Match[0].replace(/["'\\]/g, "");

      try {
        const cdnDomain = new URL(m3u8Url).hostname;
        const embedDomain = new URL(embedUrl).origin + "/";
        global.setDynamicReferer(cdnDomain, embedDomain);
        global.setFallbackReferer(embedDomain);
        for (const sub of subtitles) {
          try {
            const subDomain = new URL(sub.url).hostname;
            if (subDomain !== cdnDomain) {
              global.setDynamicReferer(subDomain, embedDomain);
            }
          } catch (_) {}
        }
      } catch (e) {}

      return {
        url: m3u8Url,
        isM3U8: true,
        quality: qualityLabel,
        isDub: server.type === "dub",
        headers: { Referer: new URL(embedUrl).origin + "/" },
        subtitles: subtitles.length > 0 ? subtitles : undefined,
      };
    }
    const mp4Match = embedHtml.match(
      /["']?file["']?\s*:\s*["']([^"']+\.mp4[^"']*)["']/,
    );
    if (mp4Match) {
      const mp4Url = mp4Match[1];
      try {
        const cdnDomain = new URL(mp4Url).hostname;
        const embedDomain = new URL(embedUrl).origin + "/";
        global.setDynamicReferer(cdnDomain, embedDomain);
        global.setFallbackReferer(embedDomain);
        for (const sub of subtitles) {
          try {
            const subDomain = new URL(sub.url).hostname;
            if (subDomain !== cdnDomain) {
              global.setDynamicReferer(subDomain, embedDomain);
            }
          } catch (_) {}
        }
      } catch (e) {}

      return {
        url: mp4Url,
        isM3U8: false,
        quality: qualityLabel,
        isDub: server.type === "dub",
        headers: { Referer: new URL(embedUrl).origin + "/" },
        subtitles: subtitles.length > 0 ? subtitles : undefined,
      };
    }

    return null;
  } catch (err) {
    console.error(`Failed to process embed ${server.url}:`, err.message);
    return null;
  }
}

module.exports = {
  name: "anineko",
  version: "2.0.2",
  SearchAnime,
  AnimeInfo,
  fetchEpisodeSources,
  fetchRecentEpisodes,
  fetchEpisode,
};
