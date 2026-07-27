const cheerio = require("cheerio");
const baseUrl = "https://weebcentral.com";

function formatUrl(src) {
  if (!src) return null;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("//")) return "https:" + src;
  return baseUrl + (src.startsWith("/") ? src : "/" + src);
}

async function latestManga(page = 1) {
  try {
    const { data } = await global.axios.get(
      `${baseUrl}/latest-updates/${page}`,
    );
    const $ = cheerio.load(data);

    const latestMangas = [];

    $("article").each((index, article) => {
      const Manga = $(article);
      let id = Manga.find("a").attr("href");
      if (id?.includes("/series/")) {
        id = id.split("/series/")?.[1].split("/")?.[0];
        if (id) {
          const rawImg = Manga.find("picture > img")?.attr("src") ?? null;
          const image = formatUrl(rawImg);
          const title =
            Manga.find(".font-semibold.text-lg")
              ?.text()
              ?.replaceAll("\n", "")
              ?.trim() ?? null;

          if (image && title) {
            latestMangas.push({
              id: id,
              title: title,
              image: image,
            });
          }
        }
      }
    });

    return {
      currentPage: page,
      hasNextPage: $("button[hx-get]").length > 0,
      results: latestMangas,
    };
  } catch (err) {
    throw err;
  }
}

async function searchManga(query, page = 1) {
  try {
    const offset = (page - 1) * 32;

    const { data } = await global.axios.get(
      `${baseUrl}/search/data?limit=32&offset=${offset}&text=${encodeURIComponent(
        query,
      )}&sort=Best+Match&order=Ascending&official=Any&anime=Any&adult=Any&display_mode=Full+Display`,
    );

    const $ = cheerio.load(data);

    const results = [];

    $("body article").each((index, article) => {
      const Manga = $(article).find("section").eq(0);
      if (Manga.length > 0) {
        let id = Manga.find("a").attr("href");
        if (id?.includes("/series/")) {
          id = id.split("/series/")?.[1].split("/")?.[0];
          if (id) {
            const MangaArticle = Manga?.find("article")?.eq(1);
            if (MangaArticle?.length > 0) {
              const rawImg = MangaArticle?.find("picture > img")?.attr("src");
              const image = formatUrl(rawImg);
              const title = MangaArticle?.find(".text-ellipsis")
                ?.first()
                ?.text()
                ?.replaceAll("\n", "")
                ?.trim();

              if (title && image) {
                results.push({
                  id: id,
                  title: title,
                  image: image,
                });
              }
            }
          }
        }
      }
    });

    return {
      currentPage: page,
      hasNextPage: $("button[hx-get]").length > 0,
      results: results,
    };
  } catch (err) {
    throw err;
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

    const { data } = await global.axios.get(`${baseUrl}/series/${mangaId}`);
    const $ = cheerio.load(data);
    const Main = $("main > div > section");

    if (Main.length > 0) {
      const LeftSections = Main.find("section");

      // left section
      mangaInfo.title = LeftSections.find("h1")
        .eq(0)
        ?.text()
        ?.trim();
      const rawImg = LeftSections.find("picture > img").attr("src");
      mangaInfo.image = formatUrl(rawImg);

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
            .replaceAll("\n", "");

          if (strongTag.includes("Type:")) {
            mangaInfo.type = $(li)
              .find("a")
              .text()
              .trim()
              .replaceAll("\n", "");
          } else if (strongTag.includes("Author(s):")) {
            const authors = [];
            $(li)
              .find("a")
              .each((i, a) => {
                authors.push($(a).text().trim().replaceAll("\n", ""));
              });
            mangaInfo.author = authors.join(", ");
          } else if (strongTag.includes("Released:")) {
            mangaInfo.released = $(li)
              .find("span")
              .text()
              .trim()
              .replaceAll("\n", "");
          }
        });

      // genres
      LeftSections.find("section")
        .eq(3)
        .find("div > a")
        .each((index, a) => {
          mangaInfo.genres.push($(a).text().trim().replaceAll("\n", ""));
        });

      // right section (description)
      mangaInfo.description = Main.find("p")
        ?.text()
        ?.trim()
        ?.replaceAll("\n", "");
    }

    return mangaInfo;
  } catch (err) {
    throw err;
  }
}

async function fetchChapters(mangaId) {
  try {
    const { data } = await global.axios.get(
      `${baseUrl}/series/${mangaId}/full-chapter-list`,
    );

    const $ = cheerio.load(data);
    const chapters = [];

    $("div > a").each((index, a) => {
      let id = $(a).attr("href");
      if (id?.includes("/chapters/")) {
        id = id.split("/chapters/")?.[1]?.split("/")?.[0];
        if (id) {
          const title = $(a)
            .find("span")
            .eq(0)
            ?.text()
            ?.replaceAll("\n", "")
            ?.trim();

          const date = $(a).find("time")?.attr("datetime");

          let chapterNum = null;
          if (title) {
            const numMatch = title.match(/Chapter\s+([\d.]+)/i);
            if (numMatch) {
              chapterNum = parseFloat(numMatch[1]);
            }
          }

          chapters.push({
            id: id,
            title: title,
            number: chapterNum !== null ? chapterNum : index + 1,
            releaseDate: date,
          });
        }
      }
    });

    return { chapters };
  } catch (err) {
    throw err;
  }
}

async function fetchChapterPages(chapterId) {
  try {
    const { data } = await global.axios.get(
      `${baseUrl}/chapters/${chapterId}/images?is_prev=False&current_page=1&reading_style=long_strip`,
    );
    const $ = cheerio.load(data);

    const pages = $("img")
      .map((index, img) => {
        const src = $(img).attr("src");
        const fullUrl = formatUrl(src);
        if (!fullUrl) return null;
        return {
          page: index + 1,
          img: `/api/image?url=${encodeURIComponent(fullUrl)}`,
          headers: { Referer: "https://weebcentral.com/" },
        };
      })
      .get()
      .filter(Boolean);

    return pages;
  } catch (err) {
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
