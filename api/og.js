import fs from 'fs';
import path from 'path';
function escapeHtml(unsafe) {
  return (unsafe || '').toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
export default async function handler(req, res) {
  try {
    const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
    const type = urlParts[0]; 
    const id = urlParts[1] ? urlParts[1].replace(/[^a-zA-Z0-9-]/g, '') : null;
    let title = 'TETO-STREAM - Watch Free Movies & TV';
    let description = 'Stream your favorite movies and TV shows for free on TETO-STREAM. High quality, no registration required, and premium experience.';
    let image = 'https://miyo-stream.tetocreations.bond/og-image.png';
    if (type && id) {
      if (type === 'movie' || type === 'tv') {
        const tmdbType = type === 'movie' ? 'movie' : 'tv';
        const tmdbUrl = `https://api.themoviedb.org/3/${tmdbType}/${id}?api_key=${process.env.TMDB_API_KEY}`;
        const response = await fetch(tmdbUrl);
        if (response.ok) {
          const data = await response.json();
          title = `${data.title || data.name} | TETO-STREAM`;
          description = data.overview || description;
          if (data.poster_path) {
            image = `https://image.tmdb.org/t/p/w1280${data.poster_path}`;
          }
        }
      } else if (type === 'anime') {
        const query = `
          query ($id: Int) {
            Media(id: $id, type: ANIME) {
              title { english romaji userPreferred }
              description
              coverImage { extraLarge large }
            }
          }
        `;
        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { id: parseInt(id) } })
        });
        if (response.ok) {
          const { data } = await response.json();
          if (data?.Media) {
            const m = data.Media;
            title = `${m.title?.english || m.title?.romaji || m.title?.userPreferred} | TETO-STREAM`;
            description = m.description?.replace(/<[^>]*>/g, '') || description;
            image = m.coverImage?.extraLarge || m.coverImage?.large || image;
          }
        }
      }
    }
    let indexPath = path.join(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(process.cwd(), 'index.html');
    }
    let html = fs.readFileSync(indexPath, 'utf8');
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeImage = escapeHtml(image);
    html = html.replace(/<title>.*?<\/title>/g, `<title>${safeTitle}</title>`);
    html = html.replace(/<meta name="title" content=".*?"\s*\/?>/g, `<meta name="title" content="${safeTitle}">`);
    html = html.replace(/<meta name="description" content=".*?"\s*\/?>/g, `<meta name="description" content="${safeDescription}">`);
    html = html.replace(/<meta property="og:title" content=".*?"\s*\/?>/g, `<meta property="og:title" content="${safeTitle}">`);
    html = html.replace(/<meta property="og:description" content=".*?"\s*\/?>/g, `<meta property="og:description" content="${safeDescription}">`);
    html = html.replace(/<meta property="og:image" content=".*?"\s*\/?>/g, `<meta property="og:image" content="${safeImage}">`);
    html = html.replace(/<meta property="twitter:title" content=".*?"\s*\/?>/g, `<meta property="twitter:title" content="${safeTitle}">`);
    html = html.replace(/<meta property="twitter:description" content=".*?"\s*\/?>/g, `<meta property="twitter:description" content="${safeDescription}">`);
    html = html.replace(/<meta property="twitter:image" content=".*?"\s*\/?>/g, `<meta property="twitter:image" content="${safeImage}">`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch (error) {
    console.error('OG Proxy Error:', error);
    try {
      let indexPath = path.join(process.cwd(), 'dist', 'index.html');
      if (!fs.existsSync(indexPath)) {
        indexPath = path.join(process.cwd(), 'index.html');
      }
      const html = fs.readFileSync(indexPath, 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(html);
    } catch (e) {
      res.status(500).send('Internal Server Error');
    }
  }
}