export type PlatformType =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'shorts'
  | 'facebook'
  | 'twitter'
  | 'pinterest'
  | 'snapchat'
  | 'threads'
  | 'reddit'
  | 'twitch'
  | 'soundcloud'
  | 'spotify'
  | 'linkedin'
  | 'vimeo'
  | 'dailymotion'
  | 'tumblr'
  | 'likee'
  | 'kwai'
  | 'capcut'
  | 'telegram'
  | 'direct'
  | 'unknown';

export function detectPlatform(urlStr: string): PlatformType {
  if (!urlStr || typeof urlStr !== 'string') return 'unknown';
  const lower = urlStr.trim().toLowerCase();

  // 1. TikTok
  if (lower.includes('tiktok.com') || lower.includes('vm.tiktok.com') || lower.includes('vt.tiktok.com')) {
    return 'tiktok';
  }

  // 2. YouTube Shorts & YouTube
  if (lower.includes('youtube.com/shorts') || lower.includes('youtu.be/shorts')) {
    return 'shorts';
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('youtube-nocookie.com')) {
    return 'youtube';
  }

  // 3. Instagram
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) {
    return 'instagram';
  }

  // 4. Facebook
  if (lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.me')) {
    return 'facebook';
  }

  // 5. X / Twitter
  if (lower.includes('twitter.com') || lower.includes('x.com') || lower.includes('t.co')) {
    return 'twitter';
  }

  // 6. Pinterest
  if (lower.includes('pinterest.com') || lower.includes('pin.it')) {
    return 'pinterest';
  }

  // 7. Snapchat
  if (lower.includes('snapchat.com')) {
    return 'snapchat';
  }

  // 8. Threads
  if (lower.includes('threads.net')) {
    return 'threads';
  }

  // 9. Reddit
  if (lower.includes('reddit.com') || lower.includes('v.redd.it') || lower.includes('redd.it')) {
    return 'reddit';
  }

  // 10. Twitch
  if (lower.includes('twitch.tv') || lower.includes('clips.twitch.tv')) {
    return 'twitch';
  }

  // 11. SoundCloud
  if (lower.includes('soundcloud.com') || lower.includes('snd.sc')) {
    return 'soundcloud';
  }

  // 12. Spotify
  if (lower.includes('spotify.com') || lower.includes('spoti.fi')) {
    return 'spotify';
  }

  // 13. LinkedIn
  if (lower.includes('linkedin.com')) {
    return 'linkedin';
  }

  // 14. Vimeo
  if (lower.includes('vimeo.com')) {
    return 'vimeo';
  }

  // 15. Dailymotion
  if (lower.includes('dailymotion.com') || lower.includes('dai.ly')) {
    return 'dailymotion';
  }

  // 16. Tumblr
  if (lower.includes('tumblr.com') || lower.includes('tmblr.co')) {
    return 'tumblr';
  }

  // 17. Likee
  if (lower.includes('likee.video') || lower.includes('l.likee.video') || lower.includes('likee.com')) {
    return 'likee';
  }

  // 18. Kwai
  if (lower.includes('kwai.com') || lower.includes('kwai-video.com') || lower.includes('kwaicc.com')) {
    return 'kwai';
  }

  // 19. CapCut
  if (lower.includes('capcut.com')) {
    return 'capcut';
  }

  // 20. Telegram
  if (lower.includes('t.me') || lower.includes('telegram.me') || lower.includes('telegram.org')) {
    return 'telegram';
  }

  // 21. Direct Media Link (ends with extensions or contains direct media signature)
  const isDirectFile = /\.(mp4|mov|mkv|webm|avi|flv|mp3|wav|m4a|aac|ogg|jpg|jpeg|png|webp|gif)($|\?)/i.test(lower);
  if (isDirectFile) {
    return 'direct';
  }

  return 'unknown';
}

export function verifyPlatformMatch(platform: PlatformType, detected: PlatformType): boolean {
  if (platform === 'unknown' || detected === 'unknown') return false;
  if (platform === 'youtube' && detected === 'shorts') return true;
  if (platform === 'shorts' && detected === 'youtube') return true;
  return platform === detected;
}
