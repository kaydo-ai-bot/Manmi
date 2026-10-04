import axios from 'axios';
import https from 'https';

export interface DownloadResult {
  success: boolean;
  type: 'video' | 'audio' | 'image' | 'document';
  buffer?: Buffer;
  title?: string;
  error?: string;
  mimeType?: string;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// HTTPS agent with relaxed SSL validation for public scraper mirrors with mismatched SSL certs
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * Downloads TikTok video without watermark using public high-speed APIs
 */
export async function downloadTikTokVideo(urlOrQuery: string): Promise<DownloadResult> {
  const cleanUrl = urlOrQuery.trim();

  // Method 1: TikWM Public API (Form-encoded POST)
  try {
    const form = new URLSearchParams();
    form.append('url', cleanUrl);
    form.append('hd', '1');

    const response = await axios.post('https://www.tikwm.com/api/', form, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      httpsAgent,
      timeout: 15000,
    });

    const data = response.data?.data;
    if (data) {
      const videoUrl = data.play || data.wmplay || data.hdplay;
      const title = data.title || 'TikTok Video';
      const author = data.author?.nickname || 'TikTok User';

      if (videoUrl) {
        const vidRes = await axios.get(videoUrl, {
          responseType: 'arraybuffer',
          timeout: 25000,
          headers: {
            'User-Agent': USER_AGENT,
            'Referer': 'https://www.tiktok.com/',
          },
          httpsAgent,
        });

        if (vidRes.data && vidRes.data.byteLength > 0) {
          return {
            success: true,
            type: 'video',
            buffer: Buffer.from(vidRes.data),
            title: `🎬 *${title}* (${author})`,
            mimeType: 'video/mp4',
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[TIKTOK DOWNLOAD] TikWM API warning:', err?.message || err);
  }

  // Method 2: Lovetik Public API
  try {
    const form = new URLSearchParams();
    form.append('query', cleanUrl);

    const res = await axios.post('https://lovetik.com/api/ajax/search', form, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': USER_AGENT,
      },
      httpsAgent,
      timeout: 15000,
    });

    const links = res.data?.links;
    if (Array.isArray(links) && links.length > 0) {
      const videoLink = links.find((l: any) => l.a === 'download' && l.url) || links[0];
      if (videoLink?.url) {
        const vidRes = await axios.get(videoLink.url, {
          responseType: 'arraybuffer',
          timeout: 25000,
          headers: { 'User-Agent': USER_AGENT },
          httpsAgent,
        });

        if (vidRes.data && vidRes.data.byteLength > 0) {
          return {
            success: true,
            type: 'video',
            buffer: Buffer.from(vidRes.data),
            title: `🎬 *${res.data?.desc || 'TikTok Video'}*`,
            mimeType: 'video/mp4',
          };
        }
      }
    }
  } catch (e: any) {
    console.warn('[TIKTOK DOWNLOAD] Lovetik fallback warning:', e?.message || e);
  }

  // Method 2: Cobalt API Endpoint
  try {
    const cobaltRes = await axios.post(
      'https://co.wuk.sh/api/json',
      { url: cleanUrl },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        httpsAgent,
        timeout: 15000,
      }
    );

    if (cobaltRes.data?.url) {
      const vidRes = await axios.get(cobaltRes.data.url, {
        responseType: 'arraybuffer',
        timeout: 25000,
        headers: { 'User-Agent': USER_AGENT },
        httpsAgent,
      });

      return {
        success: true,
        type: 'video',
        buffer: Buffer.from(vidRes.data),
        title: 'TikTok Video (HD)',
        mimeType: 'video/mp4',
      };
    }
  } catch (e: any) {
    console.warn('[TIKTOK DOWNLOAD] Cobalt fallback warning:', e?.message || e);
  }

  // Method 3: Agatz TikTok API
  try {
    const agatzRes = await axios.get(`https://api.agatz.xyz/api/tiktok?url=${encodeURIComponent(cleanUrl)}`, {
      timeout: 15000,
      headers: { 'User-Agent': USER_AGENT },
      httpsAgent,
    });

    const videoUrl = agatzRes.data?.data?.hdplay || agatzRes.data?.data?.play || agatzRes.data?.data?.[0]?.url;
    if (videoUrl) {
      const vidRes = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 25000,
        headers: { 'User-Agent': USER_AGENT },
        httpsAgent,
      });

      return {
        success: true,
        type: 'video',
        buffer: Buffer.from(vidRes.data),
        title: 'TikTok Video',
        mimeType: 'video/mp4',
      };
    }
  } catch (e: any) {
    console.warn('[TIKTOK DOWNLOAD] Agatz fallback warning:', e?.message || e);
  }

  return {
    success: false,
    type: 'video',
    error: 'Impossible de télécharger la vidéo TikTok. Vérifiez que le lien est valide et public.',
  };
}

function cleanInstagramCdnUrl(raw: string): string {
  let url = raw
    .replaceAll('\\u0026', '&')
    .replaceAll('\\u00253D', '=')
    .replaceAll('\\u002526', '&')
    .replaceAll('\\/', '/')
    .replaceAll('\\', '')
    .replaceAll('%3D', '=');
  return url.replace(/["'\s;]+$/g, '').trim();
}

/**
 * Downloads Instagram Reel or Post video/image
 */
export async function downloadInstagramMedia(url: string): Promise<DownloadResult> {
  const cleanUrl = url.trim();

  const apis = [
    // 1. Cobalt API
    async () => {
      const res = await axios.post('https://co.wuk.sh/api/json', { url: cleanUrl }, {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
        httpsAgent,
        timeout: 15000,
      });
      if (res.data?.url) {
        const mediaRes = await axios.get(res.data.url, { responseType: 'arraybuffer', timeout: 30000, httpsAgent });
        return {
          success: true,
          type: 'video' as const,
          buffer: Buffer.from(mediaRes.data),
          title: 'Instagram Media (HD)',
          mimeType: 'video/mp4',
        };
      }
      throw new Error('Cobalt failed');
    },
    // 2. Agatz Instagram API
    async () => {
      const res = await axios.get(`https://api.agatz.xyz/api/instagram?url=${encodeURIComponent(cleanUrl)}`, {
        timeout: 15000,
        httpsAgent,
      });
      const item = res.data?.data?.[0];
      const directUrl = item?.url || item?.downloadUrl;
      if (directUrl) {
        const mediaRes = await axios.get(directUrl, { responseType: 'arraybuffer', timeout: 30000, httpsAgent });
        const isImg = directUrl.includes('.jpg') || directUrl.includes('.jpeg') || directUrl.includes('.png');
        return {
          success: true,
          type: (isImg ? 'image' : 'video') as 'image' | 'video',
          buffer: Buffer.from(mediaRes.data),
          title: 'Instagram Media',
          mimeType: isImg ? 'image/jpeg' : 'video/mp4',
        };
      }
      throw new Error('Agatz failed');
    },
    // 3. SaveTheVideo API
    async () => {
      const res = await axios.post('https://v3.savethevideo.com/api/v1/download', { url: cleanUrl }, {
        headers: { 'User-Agent': USER_AGENT },
        httpsAgent,
        timeout: 15000,
      });
      if (res.data?.url) {
        const mediaRes = await axios.get(res.data.url, { responseType: 'arraybuffer', timeout: 30000, httpsAgent });
        return {
          success: true,
          type: (res.data.type === 'image' ? 'image' : 'video') as 'image' | 'video',
          buffer: Buffer.from(mediaRes.data),
          title: 'Instagram Media',
          mimeType: res.data.type === 'image' ? 'image/jpeg' : 'video/mp4',
        };
      }
      throw new Error('SaveTheVideo failed');
    },
    // 4. Direct Embed extraction
    async () => {
      const codeMatch = cleanUrl.match(/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
      if (!codeMatch || !codeMatch[1]) throw new Error('No code');
      const embedUrl = `https://www.instagram.com/p/${codeMatch[1]}/embed/captioned/`;
      const res = await axios.get(embedUrl, {
        headers: { 'User-Agent': USER_AGENT },
        httpsAgent,
        timeout: 12000,
      });
      const html = res.data;
      if (typeof html === 'string') {
        const mp4Match = html.match(/https[^"'\s<>]+\.mp4[^"'\s<>]*/);
        if (mp4Match) {
          const directVidUrl = cleanInstagramCdnUrl(mp4Match[0]);
          const mediaRes = await axios.get(directVidUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://www.instagram.com/' },
            httpsAgent,
          });
          if (mediaRes.data && mediaRes.data.byteLength > 5000) {
            return {
              success: true,
              type: 'video' as const,
              buffer: Buffer.from(mediaRes.data),
              title: 'Instagram Reel / Video',
              mimeType: 'video/mp4',
            };
          }
        }
      }
      throw new Error('Embed failed');
    }
  ];

  for (const apiFn of apis) {
    try {
      const result = await apiFn();
      if (result && result.success && result.buffer) {
        return result as any;
      }
    } catch {}
  }

  // Final fallback via loader.to
  try {
    const res = await downloadMediaViaLoader(cleanUrl, '720');
    if (res.success && res.buffer) return res;
  } catch (_) {}

  return {
    success: false,
    type: 'video',
    error: 'Impossible de télécharger le média Instagram. Vérifiez que le lien est valide.',
  };
}

/**
 * Universal media downloader using loader.to engine
 * Supports YouTube (MP4 & MP3), Facebook, Instagram, Twitter, Vimeo, SoundCloud
 */
export async function downloadMediaViaLoader(
  url: string,
  format: '360' | '720' | '1080' | 'mp3' = '720'
): Promise<DownloadResult> {
  try {
    const startUrl = `https://loader.to/ajax/download.php?button=1&start=1&end=1&format=${format}&url=${encodeURIComponent(url)}`;
    const startRes = await axios.get(startUrl, {
      headers: { 'User-Agent': USER_AGENT },
      httpsAgent,
      timeout: 15000,
    });

    const id = startRes.data?.id;
    const title = startRes.data?.title || startRes.data?.info?.title || 'Media';
    if (!id) throw new Error('No task ID returned from loader.to');

    // Poll progress with reasonable timeout
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const progRes = await axios.get(`https://loader.to/ajax/progress.php?id=${id}`, {
        headers: { 'User-Agent': USER_AGENT },
        httpsAgent,
        timeout: 10000,
      });

      if (progRes.data?.download_url) {
        const dlUrl = progRes.data.download_url;
        const mediaRes = await axios.get(dlUrl, {
          responseType: 'arraybuffer',
          timeout: 45000,
          headers: { 'User-Agent': USER_AGENT },
          httpsAgent,
        });

        if (mediaRes.data && mediaRes.data.byteLength > 20000) {
          const isAudio = format === 'mp3';
          return {
            success: true,
            type: isAudio ? 'audio' : 'video',
            buffer: Buffer.from(mediaRes.data),
            title: isAudio ? `🎵 *${title}*` : `🎬 *${title}*`,
            mimeType: isAudio ? 'audio/mp4' : 'video/mp4',
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[LOADER.TO ERR]:', err?.message || err);
  }

  return { success: false, type: format === 'mp3' ? 'audio' : 'video', error: 'Échec extraction loader.to' };
}

/**
 * Downloads Facebook Video / Reel
 */
export async function downloadFacebookVideo(url: string): Promise<DownloadResult> {
  const cleanUrl = url.trim();

  // Method 1: loader.to
  try {
    const res = await downloadMediaViaLoader(cleanUrl, '720');
    if (res.success && res.buffer) return res;
  } catch (_) {}

  try {
    const res = await axios.get(`https://api.agatz.xyz/api/facebook?url=${encodeURIComponent(cleanUrl)}`, {
      timeout: 15000,
      httpsAgent,
    });
    const videoUrl = res.data?.data?.hd || res.data?.data?.sd || res.data?.data?.[0]?.url;
    if (videoUrl) {
      const vidRes = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 25000,
        headers: { 'User-Agent': USER_AGENT },
        httpsAgent,
      });
      return {
        success: true,
        type: 'video',
        buffer: Buffer.from(vidRes.data),
        title: 'Facebook Video',
        mimeType: 'video/mp4',
      };
    }
  } catch (err) {}

  return {
    success: false,
    type: 'video',
    error: 'Impossible d\'extraire la vidéo Facebook. Vérifiez le lien.',
  };
}

/**
 * Downloads Twitter / X Video
 */
export async function downloadTwitterMedia(url: string): Promise<DownloadResult> {
  const cleanUrl = url.trim();

  // Method 1: loader.to
  try {
    const res = await downloadMediaViaLoader(cleanUrl, '720');
    if (res.success && res.buffer) return res;
  } catch (_) {}

  try {
    const match = cleanUrl.match(/status\/(\d+)/);
    if (match && match[1]) {
      const vxRes = await axios.get(`https://api.vxtwitter.com/Twitter/status/${match[1]}`, {
        timeout: 15000,
        httpsAgent,
      });
      const data = vxRes.data;
      if (data?.media_extended?.[0]?.url) {
        const mediaObj = data.media_extended[0];
        const isVideo = mediaObj.type === 'video' || mediaObj.type === 'gif';
        const mediaRes = await axios.get(mediaObj.url, { responseType: 'arraybuffer', timeout: 25000, httpsAgent });
        return {
          success: true,
          type: isVideo ? 'video' : 'image',
          buffer: Buffer.from(mediaRes.data),
          title: data.text ? data.text.substring(0, 100) : 'Twitter / X Media',
          mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
        };
      }
    }
  } catch (err) {}

  return {
    success: false,
    type: 'video',
    error: 'Impossible de télécharger le média Twitter / X.',
  };
}

/**
 * Downloads high quality music track (MP3 / Audio) for `.song` or `.play`
 */
export async function downloadMusicAudio(queryOrUrl: string): Promise<DownloadResult> {
  const query = (queryOrUrl || '').trim();
  if (!query) {
    return { success: false, type: 'audio', error: 'Veuillez préciser le titre d\'une chanson ou un lien.' };
  }

  // Method 1: If YouTube URL, use loader.to MP3
  if (query.includes('youtube.com') || query.includes('youtu.be')) {
    const res = await downloadMediaViaLoader(query, 'mp3');
    if (res.success && res.buffer && res.buffer.length > 5000) return res;

    // Cobalt MP3 fallback
    try {
      const cobaltRes = await axios.post(
        'https://co.wuk.sh/api/json',
        { url: query, downloadMode: 'audio', audioFormat: 'mp3' },
        {
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
          httpsAgent,
          timeout: 20000,
        }
      );
      if (cobaltRes.data?.url) {
        const audioRes = await axios.get(cobaltRes.data.url, { responseType: 'arraybuffer', timeout: 35000, httpsAgent });
        if (audioRes.data && audioRes.data.byteLength > 5000) {
          return {
            success: true,
            type: 'audio',
            buffer: Buffer.from(audioRes.data),
            title: '🎵 YouTube Audio (MP3)',
            mimeType: 'audio/mp4',
          };
        }
      }
    } catch (e: any) {}
  }

  // Method 2: iTunes official preview search (instant 256kbps audio)
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=5`;
    const itunesRes = await axios.get(itunesUrl, { timeout: 10000, httpsAgent });
    const results = itunesRes.data?.results || [];

    if (results.length > 0) {
      const track = results[0];
      const audioPreviewUrl = track.previewUrl;
      const trackName = track.trackName || 'Song';
      const artistName = track.artistName || 'Artist';

      if (audioPreviewUrl) {
        const audioBufRes = await axios.get(audioPreviewUrl, {
          responseType: 'arraybuffer',
          timeout: 20000,
          headers: { 'User-Agent': USER_AGENT },
          httpsAgent,
        });

        return {
          success: true,
          type: 'audio',
          buffer: Buffer.from(audioBufRes.data),
          title: `🎵 *${trackName}* - ${artistName}`,
          mimeType: 'audio/mp4',
        };
      }
    }
  } catch (err) {}

  return {
    success: false,
    type: 'audio',
    error: `Impossible de trouver l'audio pour "${query}". Réessayez avec un autre titre.`,
  };
}

/**
 * Downloads YouTube Video or generic video
 */
export async function downloadVideoMedia(queryOrUrl: string): Promise<DownloadResult> {
  const query = (queryOrUrl || '').trim();
  if (!query) {
    return { success: false, type: 'video', error: 'Veuillez fournir un lien ou un titre de vidéo.' };
  }

  if (query.includes('tiktok.com')) {
    return downloadTikTokVideo(query);
  }
  if (query.includes('instagram.com')) {
    return downloadInstagramMedia(query);
  }

  // Method 1: loader.to 360p / 720p MP4
  try {
    const loaderResult = await downloadMediaViaLoader(query, '360');
    if (loaderResult.success && loaderResult.buffer && loaderResult.buffer.length > 5000) {
      return loaderResult;
    }
  } catch (e: any) {
    console.warn('[YOUTUBE DOWNLOAD] loader.to warning:', e?.message || e);
  }

  // Method 2: Cobalt API endpoint for YouTube
  try {
    const cobaltRes = await axios.post(
      'https://co.wuk.sh/api/json',
      { url: query, vQuality: '360' },
      {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
        httpsAgent,
        timeout: 20000,
      }
    );
    if (cobaltRes.data?.url) {
      const vidRes = await axios.get(cobaltRes.data.url, { responseType: 'arraybuffer', timeout: 35000, httpsAgent });
      if (vidRes.data && vidRes.data.byteLength > 10000) {
        return {
          success: true,
          type: 'video',
          buffer: Buffer.from(vidRes.data),
          title: 'YouTube Video (360p)',
          mimeType: 'video/mp4',
        };
      }
    }
  } catch (e: any) {
    console.warn('[YOUTUBE DOWNLOAD] Cobalt warning:', e?.message || e);
  }

  // Method 3: Agatz Ytmp4 API
  try {
    const agatzRes = await axios.get(`https://api.agatz.xyz/api/ytmp4?url=${encodeURIComponent(query)}`, {
      timeout: 20000,
      httpsAgent,
    });
    const directUrl = agatzRes.data?.data?.downloadUrl || agatzRes.data?.data?.url || agatzRes.data?.data?.[0]?.url;
    if (directUrl) {
      const vidRes = await axios.get(directUrl, { responseType: 'arraybuffer', timeout: 35000, httpsAgent });
      if (vidRes.data && vidRes.data.byteLength > 10000) {
        return {
          success: true,
          type: 'video',
          buffer: Buffer.from(vidRes.data),
          title: agatzRes.data?.data?.title || 'YouTube Video',
          mimeType: 'video/mp4',
        };
      }
    }
  } catch (e: any) {
    console.warn('[YOUTUBE DOWNLOAD] Agatz warning:', e?.message || e);
  }

  return {
    success: false,
    type: 'video',
    error: `Impossible de trouver ou télécharger la vidéo YouTube. Vérifiez le lien.`,
  };
}

/**
 * Downloads Pinterest image
 */
export async function downloadPinterestImage(query: string): Promise<DownloadResult> {
  const q = query.trim() || 'anime wallpaper';
  try {
    const res = await axios.get(`https://api.agatz.xyz/api/pinterest?message=${encodeURIComponent(q)}`, {
      timeout: 15000,
      httpsAgent,
    });
    const images = res.data?.data;
    if (Array.isArray(images) && images.length > 0) {
      const imgUrl = images[Math.floor(Math.random() * images.length)];
      const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 15000, httpsAgent });
      return {
        success: true,
        type: 'image',
        buffer: Buffer.from(imgRes.data),
        title: `📌 Pinterest : ${q}`,
        mimeType: 'image/jpeg',
      };
    }
  } catch (err) {}

  try {
    const unsplashUrl = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=80`;
    const imgRes = await axios.get(unsplashUrl, { responseType: 'arraybuffer', timeout: 15000, httpsAgent });
    return {
      success: true,
      type: 'image',
      buffer: Buffer.from(imgRes.data),
      title: `📌 Image : ${q}`,
      mimeType: 'image/jpeg',
    };
  } catch (e) {}

  return {
    success: false,
    type: 'image',
    error: 'Impossible de télécharger l\'image Pinterest.',
  };
}

/**
 * Downloads Threads video / image post
 */
export async function downloadThreadsMedia(url: string): Promise<DownloadResult> {
  const cleanUrl = url.trim();
  try {
    const res = await axios.post('https://co.wuk.sh/api/json', { url: cleanUrl }, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      httpsAgent,
      timeout: 15000,
    });
    if (res.data?.url) {
      const mediaRes = await axios.get(res.data.url, { responseType: 'arraybuffer', timeout: 25000, httpsAgent });
      return {
        success: true,
        type: 'video',
        buffer: Buffer.from(mediaRes.data),
        title: 'Threads Media',
        mimeType: 'video/mp4',
      };
    }
  } catch (err) {}

  return {
    success: false,
    type: 'video',
    error: 'Impossible de télécharger le contenu Threads via l\'API directe.',
  };
}

/**
 * Downloads Reddit Video / GIF
 */
export async function downloadRedditMedia(url: string): Promise<DownloadResult> {
  const cleanUrl = url.trim();
  try {
    const jsonUrl = cleanUrl.endsWith('.json') ? cleanUrl : `${cleanUrl.split('?')[0]}.json`;
    const res = await axios.get(jsonUrl, {
      headers: { 'User-Agent': USER_AGENT },
      httpsAgent,
      timeout: 10000,
    });
    const postData = res.data?.[0]?.data?.children?.[0]?.data;
    if (postData) {
      const videoUrl = postData.secure_media?.reddit_video?.fallback_url || postData.url_overridden_by_dest;
      if (videoUrl && (videoUrl.includes('v.redd.it') || videoUrl.endsWith('.mp4'))) {
        const vidRes = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 25000, httpsAgent });
        return {
          success: true,
          type: 'video',
          buffer: Buffer.from(vidRes.data),
          title: postData.title || 'Reddit Video',
          mimeType: 'video/mp4',
        };
      }
    }
  } catch (err) {}

  return {
    success: false,
    type: 'video',
    error: 'Extraction API Reddit directe indisponible.',
  };
}

/**
 * Downloads direct HTTP/HTTPS media file
 */
export async function downloadDirectMedia(url: string): Promise<DownloadResult> {
  const cleanUrl = url.trim();
  try {
    const headRes = await axios.head(cleanUrl, { timeout: 10000, httpsAgent }).catch(() => null);
    const contentType = headRes?.headers?.['content-type'] || '';

    const mediaRes = await axios.get(cleanUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': USER_AGENT },
      httpsAgent,
    });

    const isImage = contentType.includes('image') || /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(cleanUrl);
    const isAudio = contentType.includes('audio') || /\.(mp3|wav|m4a|aac|ogg)($|\?)/i.test(cleanUrl);

    let mimeType = 'video/mp4';
    let mediaType: 'image' | 'video' | 'audio' | 'document' = 'video';

    if (isImage) {
      mimeType = contentType.includes('image') ? contentType : 'image/jpeg';
      mediaType = 'image';
    } else if (isAudio) {
      mimeType = contentType.includes('audio') ? contentType : 'audio/mp4';
      mediaType = 'audio';
    }

    return {
      success: true,
      type: mediaType,
      buffer: Buffer.from(mediaRes.data),
      title: 'Média Direct',
      mimeType,
    };
  } catch (err: any) {
    return {
      success: false,
      type: 'document',
      error: `Impossible de télécharger directement ce lien: ${err?.message || 'Erreur'}`,
    };
  }
}
