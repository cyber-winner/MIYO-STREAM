import{b as e,v as t}from"./index-BhiXbuVO.js";var n=`/api/anilist`,r=`https://graphql.anilist.co`,i=new Map,a=6e4;function o(e,t){return JSON.stringify({q:e.replace(/\s+/g,` `).trim(),v:t})}var s=0,c=700;async function l(l,u={}){let d=o(l,u),f=i.get(d);if(f&&Date.now()-f.time<a)return f.data;let p=Date.now()-s;p<c&&await new Promise(e=>setTimeout(e,c-p)),s=Date.now();let m=JSON.stringify({query:l,variables:u}),h={"Content-Type":`application/json`,Accept:`application/json`},g;for(let a=0;a<3;a++)try{let o;if(t()){let t=await e(r,{method:`POST`,headers:h,body:m});o={ok:t.ok,status:t.status,headers:{get:e=>t.header(e)},json:()=>t.json()}}else o=await fetch(n,{method:`POST`,headers:h,body:m});if(o.status===429){let e=parseInt(o.headers.get(`Retry-After`)||`0`)||(a+1)*2;console.warn(`[AniList] Rate limited, retrying in ${e}s...`),typeof window<`u`&&window.dispatchEvent(new CustomEvent(`miyo-toast`,{detail:{message:`System data flow is constrained. Retrying in ${e}s...`,type:`warning`}})),await new Promise(t=>setTimeout(t,e*1e3));continue}if(!o.ok)throw Error(`Proxy returned ${o.status}`);let s=await o.json();if(s.errors?.some(e=>e.status===429||e.message?.includes(`Too Many`))){let e=(a+1)*2;console.warn(`[AniList] Rate limited via error body, retrying in ${e}s...`),typeof window<`u`&&window.dispatchEvent(new CustomEvent(`miyo-toast`,{detail:{message:`System data flow is constrained. Retrying in ${e}s...`,type:`warning`}})),await new Promise(t=>setTimeout(t,e*1e3));continue}if(s.errors)throw console.error(`[AniList] API Error:`,s.errors),Error(s.errors[0]?.message||`AniList API error`);return i.set(d,{data:s.data,time:Date.now()}),s.data}catch(e){g=e,a<2&&await new Promise(e=>setTimeout(e,(a+1)*1500))}let _=(g?.message||``).toLowerCase();throw _.includes(`429`)||_.includes(`too many`)||g?.status===429?Error(`You are going too fast! We hit rate limit. Try again after 1 minute.`):g||Error(`AniList request failed after retries`)}var u=`
  id
  title {
    romaji
    english
    native
    userPreferred
  }
  type
  format
  status
  season
  seasonYear
  episodes
  chapters
  volumes
  duration
  averageScore
  meanScore
  popularity
  favourites
  genres
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  isAdult
  siteUrl
  nextAiringEpisode {
    airingAt
    timeUntilAiring
    episode
  }
`,d=`
  id
  idMal
  title {
    romaji
    english
    native
    userPreferred
  }
  type
  format
  status
  description(asHtml: false)
  season
  seasonYear
  episodes
  chapters
  volumes
  duration
  averageScore
  meanScore
  popularity
  favourites
  genres
  tags {
    id
    name
    category
    rank
    isAdult
  }
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  startDate { year month day }
  endDate { year month day }
  isAdult
  siteUrl
  trailer {
    id
    site
    thumbnail
  }
  nextAiringEpisode {
    airingAt
    timeUntilAiring
    episode
  }
  streamingEpisodes {
    title
    thumbnail
    url
    site
  }
  studios(isMain: true) {
    nodes { id name siteUrl }
  }
  rankings {
    rank
    type
    format
    season
    year
    allTime
  }
  externalLinks {
    id
    url
    site
    type
  }
  relations {
    edges {
      relationType
      node {
        id
        title { romaji english userPreferred }
        type
        format
        status
        coverImage { large medium }
        averageScore
        episodes
        chapters
      }
    }
  }
  characters(sort: [ROLE, RELEVANCE], page: 1, perPage: 20) {
    edges {
      role
      voiceActors(language: JAPANESE) {
        id
        name { full native }
        image { large medium }
        languageV2
      }
      node {
        id
        name { full native }
        image { large medium }
      }
    }
  }
  staff(sort: [RELEVANCE], page: 1, perPage: 10) {
    edges {
      role
      node {
        id
        name { full native }
        image { large medium }
      }
    }
  }
  recommendations(sort: [RATING_DESC], page: 1, perPage: 12) {
    nodes {
      mediaRecommendation {
        id
        title { romaji english userPreferred }
        type
        format
        coverImage { large medium }
        averageScore
        episodes
        chapters
        status
      }
    }
  }
`,f={getTrending:async(e=1,t=20)=>(await l(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: ANIME, sort: [TRENDING_DESC], isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:e,perPage:t})).Page,getPopular:async(e=1,t=20)=>(await l(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: ANIME, sort: [POPULARITY_DESC], isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:e,perPage:t})).Page,getTopRated:async(e=1,t=20)=>(await l(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: ANIME, sort: [SCORE_DESC], isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:e,perPage:t})).Page,getAiring:async(e=1,t=20)=>(await l(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: ANIME, status: RELEASING, sort: [POPULARITY_DESC], isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:e,perPage:t})).Page,getSeason:async(e,t,n=1,r=20,i=[`POPULARITY_DESC`])=>(await l(`
      query ($page: Int, $perPage: Int, $season: MediaSeason, $year: Int, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: ANIME, season: $season, seasonYear: $year, sort: $sort, isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:n,perPage:r,season:e,year:t,sort:i})).Page,getByGenre:async(e,t=1,n=20,r=`ANIME`)=>(await l(`
      query ($page: Int, $perPage: Int, $genre: String, $type: MediaType) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: $type, genre: $genre, sort: [POPULARITY_DESC], isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:t,perPage:n,genre:e,type:r})).Page,searchAnime:async(e,t=1,n=20)=>(await l(`
      query ($page: Int, $perPage: Int, $search: String) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(search: $search, type: ANIME, sort: [SEARCH_MATCH], isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:t,perPage:n,search:e})).Page,searchManga:async(e,t=1,n=20)=>(await l(`
      query ($page: Int, $perPage: Int, $search: String) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(search: $search, type: MANGA, sort: [SEARCH_MATCH], isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:t,perPage:n,search:e})).Page,getDetail:async e=>(await l(`
      query ($id: Int) {
        Media(id: $id) {
          ${d}
        }
      }
    `,{id:parseInt(e)})).Media,getMangaTrending:async(e=1,t=20)=>(await l(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: MANGA, sort: [TRENDING_DESC], isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:e,perPage:t})).Page,getMangaPopular:async(e=1,t=20)=>(await l(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: MANGA, sort: [POPULARITY_DESC], isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:e,perPage:t})).Page,getMangaTopRated:async(e=1,t=20)=>(await l(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: MANGA, sort: [SCORE_DESC], isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:e,perPage:t})).Page,getMangaByGenre:async(e,t=1,n=20)=>(await l(`
      query ($page: Int, $perPage: Int, $genre: String) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(type: MANGA, genre: $genre, sort: [POPULARITY_DESC], isAdult: false) {
            ${u}
          }
        }
      }
    `,{page:t,perPage:n,genre:e})).Page,browse:async({type:e=`ANIME`,sort:t=[`POPULARITY_DESC`],genre:n,season:r,seasonYear:i,format:a,status:o,page:s=1,perPage:c=20}={})=>(await l(`
      query (
        $page: Int, $perPage: Int, $type: MediaType, $sort: [MediaSort],
        $genre: String, $season: MediaSeason, $seasonYear: Int,
        $format: MediaFormat, $status: MediaStatus
      ) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total currentPage lastPage hasNextPage perPage }
          media(
            type: $type, sort: $sort, genre: $genre,
            season: $season, seasonYear: $seasonYear,
            format: $format, status: $status, isAdult: false
          ) {
            ${u}
          }
        }
      }
    `,{page:s,perPage:c,type:e,sort:t,genre:n||void 0,season:r||void 0,seasonYear:i||void 0,format:a||void 0,status:o||void 0})).Page,getGenres:()=>[`Action`,`Adventure`,`Comedy`,`Drama`,`Ecchi`,`Fantasy`,`Horror`,`Mahou Shoujo`,`Mecha`,`Music`,`Mystery`,`Psychological`,`Romance`,`Sci-Fi`,`Slice of Life`,`Sports`,`Supernatural`,`Thriller`],getFormats:()=>({ANIME:[{value:`TV`,label:`TV`},{value:`TV_SHORT`,label:`TV Short`},{value:`MOVIE`,label:`Movie`},{value:`SPECIAL`,label:`Special`},{value:`OVA`,label:`OVA`},{value:`ONA`,label:`ONA`},{value:`MUSIC`,label:`Music`}],MANGA:[{value:`MANGA`,label:`Manga`},{value:`NOVEL`,label:`Light Novel`},{value:`ONE_SHOT`,label:`One Shot`}]}),getSeasons:()=>[`WINTER`,`SPRING`,`SUMMER`,`FALL`],getStatusOptions:()=>({ANIME:[{value:`RELEASING`,label:`Airing`},{value:`FINISHED`,label:`Finished`},{value:`NOT_YET_RELEASED`,label:`Upcoming`},{value:`CANCELLED`,label:`Cancelled`}],MANGA:[{value:`RELEASING`,label:`Publishing`},{value:`FINISHED`,label:`Finished`},{value:`NOT_YET_RELEASED`,label:`Upcoming`},{value:`HIATUS`,label:`Hiatus`}]}),formatScore:e=>e?`${e}%`:`N/A`,formatStatus:e=>({FINISHED:`Finished`,RELEASING:`Airing`,NOT_YET_RELEASED:`Upcoming`,CANCELLED:`Cancelled`,HIATUS:`Hiatus`})[e]||e,formatFormat:e=>({TV:`TV`,TV_SHORT:`TV Short`,MOVIE:`Movie`,SPECIAL:`Special`,OVA:`OVA`,ONA:`ONA`,MUSIC:`Music`,MANGA:`Manga`,NOVEL:`Light Novel`,ONE_SHOT:`One Shot`})[e]||e,formatSeason:e=>({WINTER:`Winter`,SPRING:`Spring`,SUMMER:`Summer`,FALL:`Fall`})[e]||e,getCurrentSeason:()=>{let e=new Date().getMonth()+1;return e>=1&&e<=3?{season:`WINTER`,year:new Date().getFullYear()}:e>=4&&e<=6?{season:`SPRING`,year:new Date().getFullYear()}:e>=7&&e<=9?{season:`SUMMER`,year:new Date().getFullYear()}:{season:`FALL`,year:new Date().getFullYear()}},getNextSeason:()=>{let e=f.getCurrentSeason(),t=[`WINTER`,`SPRING`,`SUMMER`,`FALL`],n=t.indexOf(e.season);return n===3?{season:`WINTER`,year:e.year+1}:{season:t[n+1],year:e.year}}};export{f as t};