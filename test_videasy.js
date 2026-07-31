import axios from 'axios';

async function testScrape() {
  const tmdbId = 27205; // Inception
  const url = `https://player.videasy.net/movie/${tmdbId}`;
  
  try {
    console.log('Fetching', url);
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    console.log('HTML length:', res.data.length);
    // Try to find m3u8 or sources in the HTML
    const match = res.data.match(/source['"]?\s*:\s*['"](http[^'"]+\.m3u8[^'"]*)['"]/i);
    if (match) {
      console.log('Found m3u8:', match[1]);
    } else {
      console.log('No m3u8 found in HTML directly.');
      // Let's dump some snippet
      const lines = res.data.split('\n').filter(l => l.includes('.m3u8') || l.includes('source') || l.includes('file'));
      console.log(lines.join('\n').substring(0, 500));
    }
  } catch (err) {
    console.error(err.message);
  }
}

testScrape();
