/**
 * StrawVerse Extension - WeebCentral Scraper
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
const baseUrl = "https://weebcentral.com";

async function latestManga(page = 1) {
  try {
    const { data } = await global.axios.get(
      `${baseUrl}/latest-updates/${page}`,
      {
        headers: {
          'Referer': `${baseUrl}/`,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      }
    );
    const $ = cheerio.load(data);

    const latestMangas = [];
    const seenIds = new Set();

    $("a[href*='/series/'].link-hover, a[href*='/series/'].line-clamp-1, div.text-ellipsis").each((index, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr("href") || $(el).closest("a").attr("href") || $(el).closest("section").parent().find("a[href*='/series/']").attr("href");
      if (href && href.includes("/series/")) {
        const id = href.split("/series/")[1]?.split("/")?.[0];
        if (id && title && title !== "Official" && !title.startsWith("http") && !seenIds.has(id)) {
          seenIds.add(id);
          const parent = $(el).closest("section").parent();
          const imgEl = parent.find("img").first();
          const image = imgEl.attr("src") || imgEl.attr("data-src") || null;

          latestMangas.push({
            id: id,
            title: title,
            image: image ? `/api/image?url=${encodeURIComponent(image)}` : null,
          });
        }
      }
    });

    return {
      current_page: page,
      hasNextPage: $("button[hx-get]").length > 0 || latestMangas.length > 0,
      results: latestMangas,
    };
  } catch (err) {
    console.error("[WeebCentral] latestManga error:", err.message);
    return {
      current_page: page,
      hasNextPage: false,
      results: [],
    };
  }
}

async function searchManga(query, page = 1) {
  try {
    const offset = (page - 1) * 32;

    const { data } = await global.axios.get(
      `${baseUrl}/search/data?limit=32&offset=${offset}&text=${encodeURIComponent(
        query,
      )}&sort=Best+Match&order=Ascending&official=Any&anime=Any&adult=Any&display_mode=Full+Display`,
      {
        headers: {
          'Referer': `${baseUrl}/search`,
          'HX-Request': 'true',
          'HX-Target': 'search-results',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      }
    );

    const $ = cheerio.load(data);

    const results = [];
    const seenIds = new Set();

    $("a[href*='/series/'].link-hover, a[href*='/series/'].line-clamp-1, div.text-ellipsis").each((index, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr("href") || $(el).closest("a").attr("href") || $(el).closest("section").parent().find("a[href*='/series/']").attr("href");
      if (href && href.includes("/series/")) {
        const id = href.split("/series/")[1]?.split("/")?.[0];
        if (id && title && title !== "Official" && !title.startsWith("http") && !seenIds.has(id)) {
          seenIds.add(id);
          const parent = $(el).closest("section").parent();
          const imgEl = parent.find("img").first();
          const image = imgEl.attr("src") || imgEl.attr("data-src") || null;

          results.push({
            id: id,
            title: title,
            image: image ? `/api/image?url=${encodeURIComponent(image)}` : null,
          });
        }
      }
    });

    return {
      current_page: page,
      hasNextPage: $("button[hx-get]").length > 0 || results.length === 32,
      results: results,
    };
  } catch (err) {
    console.error("[WeebCentral] searchManga error:", err.message);
    return {
      current_page: page,
      hasNextPage: false,
      results: [],
    };
  }
}

async function fetchMangaInfo(mangaId) {
  try {
    let mangaInfo = {
      id: mangaId,
      genres: [],
      type: "",
      author: "",
      released: "",
    };

    const { data } = await global.axios.get(`${baseUrl}/series/${mangaId}`, {
      headers: {
        'Referer': `${baseUrl}/`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const $ = cheerio.load(data);
    const Main = $("main > div > section");

    if (Main.length > 0) {
      const LeftSections = Main.find("section");

      // left section
      mangaInfo.title = LeftSections.find("h1")
        .eq(0)
        ?.text()
        ?.trim()
        ?.toLowerCase();
      const imgUrl = LeftSections.find("picture > img, img").first().attr("src");
      mangaInfo.image = imgUrl ? `/api/image?url=${encodeURIComponent(imgUrl)}` : null;
      // extra info
      LeftSections.find("section")
        .eq(2)
        .find("ul")
        .find("li")
        .each((index, li) => {
          let strongTag = $(li)
            .find("strong")
            .text()
            .trim()
            .replace(":", "")
            .replace("(s)", "")
            .toLowerCase();

          if (strongTag === "tags") strongTag = "genres";

          if (mangaInfo.hasOwnProperty(strongTag)) {
            let value = $(li)
              .find("a, span")
              .map((i, el) => $(el).text().trim().replace(/,$/, ""))
              .get();

            value = [...new Set(value)].filter((v) => v !== "");

            mangaInfo[strongTag] = Array.isArray(mangaInfo[strongTag])
              ? value
              : value[0];
          }
        });

      // Right section
      const RightSections = Main.eq(0).children("section").eq(1);

      const descriptionSection = RightSections.find(
        "li:has(strong:contains('Description')) p",
      );

      mangaInfo.description = descriptionSection.length
        ? descriptionSection.text().trim()
        : null;
    }

    return mangaInfo;
  } catch (err) {
    console.error("[WeebCentral] fetchMangaInfo error:", err.message);
    return {
      id: mangaId,
      title: mangaId,
      genres: [],
      type: "",
      author: "",
      released: "",
      description: null,
    };
  }
}

async function fetchChapters(mangaId) {
  try {
    const { data } = await global.axios.get(
      `${baseUrl}/series/${mangaId}/full-chapter-list`,
      {
        headers: {
          'Referer': `${baseUrl}/series/${mangaId}`,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      }
    );
    const $ = cheerio.load(data);

    let chapterLinks = [];
    const seenChapterIds = new Set();

    $("a[href*='/chapters/']").each((i, el) => {
      const href = $(el).attr("href");
      if (href && href.includes("/chapters/")) {
        const id = href.split("/chapters/")[1];
        if (id && !seenChapterIds.has(id)) {
          seenChapterIds.add(id);
          const rawText = $(el).find("span").first().text().trim() || $(el).text().trim();
          const cleanTitle = rawText.split("\n")[0].trim();
          chapterLinks.push({
            id: id,
            title: cleanTitle,
          });
        }
      }
    });

    // Assign chapter numbers (ascending 1..N or descending)
    chapterLinks = chapterLinks.map((chap, idx) => ({
      ...chap,
      number: chapterLinks.length - idx,
    }));

    // Reverse to oldest-first order
    chapterLinks.reverse();

    return {
      TotalPages: 1,
      total: chapterLinks?.length ?? 0,
      Chapters: chapterLinks,
      chapters: chapterLinks,
    };
  } catch (err) {
    console.error("[WeebCentral] fetchChapters error:", err.message);
    return {
      TotalPages: 0,
      total: 0,
      Chapters: [],
      chapters: [],
    };
  }
}

async function fetchChapterPages(chapterId) {
  try {
    const { data } = await global.axios.get(
      `${baseUrl}/chapters/${chapterId}/images?is_prev=False&current_page=1&reading_style=long_strip`,
      {
        headers: {
          'Referer': `${baseUrl}/chapters/${chapterId}`,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      }
    );
    const $ = cheerio.load(data);

    const pages = $("img")
      .map((index, img) => {
        const src = $(img).attr("src");
        return src ? {
          page: index + 1,
          img: `/api/image?url=${encodeURIComponent(src)}`,
        } : null;
      })
      .get()
      .filter(Boolean);

    return pages;
  } catch (err) {
    console.error("[WeebCentral] fetchChapterPages error:", err.message);
    return [];
  }
}

module.exports = {
  name: "weebcentral",
  version: "2.0.0",
  latestManga,
  searchManga,
  fetchMangaInfo,
  fetchChapters,
  fetchChapterPages,
};
