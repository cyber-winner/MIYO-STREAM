/**
 * StrawVerse Extension - AnimePahe Scraper
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

// imports
const cheerio = require("cheerio");

// variables
const baseUrl = "https://animepahe.pw";

// Anime Search
async function SearchAnime(query, filters = {}) {
  try {
    const { data } = await global.axios.get(
      `${baseUrl}/api?m=search&q=${encodeURIComponent(query)}`,
      {
        headers: {
          Referer: baseUrl,
        },
      },
    );
    const res = {
      currentPage: 1,
      hasNextPage: false,
      totalPages: 1,
      results: data.data.map((item) => ({
        id: `${item.session}`,
        title: item.title,
        image: item?.poster ? `/api/image?url=${item?.poster}` : null,
      })),
    };
    return res;
  } catch (err) {
    throw new Error(err.message);
  }
}

// Recent Episodes
async function fetchRecentEpisodes(filters = {}) {
  try {
    const { data } = await global.axios.get(
      `${baseUrl}/api?m=airing&page=${filters.page}`,
      {
        headers: {
          Referer: baseUrl,
        },
      },
    );
    const res = {
      currentPage: filters.page,
      hasNextPage: data?.next_page_url?.length > 0 ? true : false,
      totalPages: data?.last_page ?? 0,
      results: data.data.map((item) => ({
        id: `${item.anime_session}`,
        title: item.anime_title,
        image: item?.snapshot ? `/api/image?url=${item?.snapshot}` : null,
        episode: item.episode,
      })),
    };
    return res;
  } catch (err) {
    throw new Error(err.message);
  }
}

// Animeinfo
async function AnimeInfo(id) {
  let suffix = id.endsWith("dub") ? "dub" : id.endsWith("sub") ? "sub" : "both";
  id = id.replace(/-(dub|sub|both)$/, "");

  const animeInfo = {
    id: `${id}-${suffix}`,
    title: "",
  };

  try {
    const { data } = await global.axios.get(`${baseUrl}/anime/${id}`, {
      headers: {
        Referer: baseUrl,
      },
    });
    const $ = (0, cheerio.load)(data);

    let MalId =
      parseInt($('meta[name="myanimelist"]').attr("content") ?? null) ?? null;

    animeInfo.malid = MalId;
    animeInfo.title = $("div.title-wrapper > h1 > span").first().text();
    let image = $("div.anime-poster a").attr("href") ?? null;
    animeInfo.image = image ? `/api/image?url=${image}` : null;
    animeInfo.description = $("div.anime-summary").text();
    animeInfo.genres = $("div.anime-genre ul li")
      .map((i, el) => $(el).find("a").attr("title"))
      .get();
    switch (
      $('div.col-sm-4.anime-info p:icontains("Status:") a').text().trim()
    ) {
      case "Currently Airing":
        animeInfo.status = "Ongoing";
        break;
      case "Finished Airing":
        animeInfo.status = "Completed";
        break;
      default:
        animeInfo.status = "Unknown";
    }

    animeInfo.type = $('div.col-sm-4.anime-info p:icontains("Type") a')
      .text()
      .trim()
      .toUpperCase();

    animeInfo.aired = $('div.col-sm-4.anime-info p:icontains("Aired")')
      .text()
      .replace("Aired:", "")
      .replaceAll("\n", " ")
      .replaceAll("  ", "")
      .trim();

    animeInfo.dataId = id;
    animeInfo.subOrDub = suffix;

    return animeInfo;
  } catch (error) {
    console.error("Error fetching data from AnimePahe:", error);
    throw error;
  }
}

const firstEpCache = {};

async function getFirstEpisodeNumber(id, lastPage) {
  if (firstEpCache[id] !== undefined) {
    return firstEpCache[id];
  }
  try {
    const { data } = await global.axios.get(
      `${baseUrl}/api?m=release&id=${id}&sort=episode_desc&page=${lastPage}`,
      {
        headers: {
          Referer: baseUrl,
        },
      }
    );
    if (data?.data && data.data.length > 0) {
      const firstEp = data.data[data.data.length - 1].episode;
      firstEpCache[id] = firstEp;
      return firstEp;
    }
  } catch (err) {
    console.error("Failed to fetch first episode number:", err);
  }
  firstEpCache[id] = 1;
  return 1;
}

// Fetching Episodes Pages
async function fetchEpisode(id, page = 1) {
  try {
    let episodes = [];
    id = id.replace(/-(dub|sub|both)$/, "");

    let { last_page, data, total } = (
      await global.axios.get(
        `${baseUrl}/api?m=release&id=${id}&sort=episode_desc&page=${page}`,
        {
          headers: {
            Referer: baseUrl,
          },
        },
      )
    ).data;

    const firstEpNum = await getFirstEpisodeNumber(id, last_page);
    const offset = firstEpNum - 1;

    data.forEach((item) => {
      let hasEngAudio = item?.audio && item?.audio?.toLowerCase() === "eng";
      let mappedNumber = item.episode - offset;
      if (mappedNumber < 1) mappedNumber = item.episode;

      episodes.push({
        id: `${id}/${item.session}`,
        number: mappedNumber,
        title: item.title,
        duration: item.duration,
        lang: hasEngAudio ? "both" : "sub",
      });
    });

    return {
      episodes: episodes,
      totalPages: last_page,
      total: total,
      currentPage: page,
    };
  } catch (err) {
    return { episodes: [], totalPages: 0, total: 0, currentPage: page };
  }
}

// fetching Episodes Download Links
async function fetchEpisodeSources(episodeId) {
  try {
    const isBoth = episodeId.endsWith("both");
    const isDub = episodeId.endsWith("dub") ? true : false;

    episodeId = episodeId.replace(/-(dub|sub|both)$/, "");

    const { data } = await global.axios.get(`${baseUrl}/play/${episodeId}`, {
      headers: {
        Referer: baseUrl,
      },
    });
    const $ = (0, cheerio.load)(data);

    const links = $("div#resolutionMenu > button").map((i, el) => ({
      url: $(el).attr("data-src"),
      quality: extractQualityNumber($(el).text()),
      audio: $(el).attr("data-audio"),
    }));

    let iSource = {};

    if (!isBoth) iSource.sources = [];
    if (isBoth)
      iSource = {
        dub: {
          sources: [],
        },
        sub: {
          sources: [],
        },
      };

    await Promise.all(
      links.get().map((link) =>
        Promise.race([
          (async () => {
            try {
              const res = await extract(new URL(link.url));
              if (res && res[0]) {
                res[0].quality = link.quality;
                res[0].isDub = link.audio === "eng";
                if (isBoth) {
                  if (res[0]?.isDub) {
                    iSource.dub.sources.push(res[0]);
                  } else if (!res[0]?.isDub) {
                    iSource.sub.sources.push(res[0]);
                  }
                } else {
                  if (isDub && res[0].isDub) {
                    iSource.sources.push(res[0]);
                  } else if (!isDub && !res[0].isDub) {
                    iSource.sources.push(res[0]);
                  }
                }
              }
            } catch (err) {
              console.error("Failed to extract link:", err.message);
            }
          })(),
          new Promise((resolve) => setTimeout(resolve, 4000)),
        ]),
      ),
    );
    return iSource;
  } catch (err) {
    console.error("Error fetching data from AnimePahe:", err);
    return { sources: [] };
  }
}

// helpers for extracting video links
function extractQualityNumber(qualityString) {
  const match = qualityString.match(/\d+p/);
  return match ? match[0] : "";
}

// helpers for extracting video links
async function extract(videoUrl, retries = 2, delay = 1000) {
  let sources = [];
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data } = await global.axios.get(videoUrl.href);
      const match = /(eval)(\(f.*?)(<\/script>)/s.exec(data);
      if (!match) {
        throw new Error("Failed to find video source packer block");
      }
      const source = eval(match[2].replace("eval", "")).match(/https.*?m3u8/);
      sources.push({
        url: source[0],
        isM3U8: source[0].includes(".m3u8"),
      });
      return sources;
    } catch (err) {
      if (
        (err.response?.status === 429 || err.message.includes("429")) &&
        attempt < retries
      ) {
        console.warn(
          `Request to ${videoUrl.href} returned 429. Retrying in ${delay}ms (attempt ${attempt}/${retries})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw new Error(err.message);
    }
  }
}

module.exports = {
  name: "pahe",
  version: "3.1.0",
  SearchAnime,
  AnimeInfo,
  fetchEpisodeSources,
  fetchRecentEpisodes,
  fetchEpisode,
};
