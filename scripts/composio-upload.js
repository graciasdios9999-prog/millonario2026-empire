/**
 * Composio-based upload helper for use within GitHub Actions
 * Called by the master loop when Composio credentials are available
 * 
 * Usage: 
 *   FACEBOOK: node scripts/composio-upload.js facebook <video_url> <title> <description>
 *   YOUTUBE: Uses Zapier webhook (Composio doesn't support video/mp4 upload)
 */

const axios = require('axios');

const FB_PAGE_ID = '117307510398180';

async function uploadToFacebookViaAPI(videoUrl, title, description) {
  const token = process.env.FACEBOOK_PAGE_TOKEN;
  if (!token) throw new Error('FACEBOOK_PAGE_TOKEN required');

  const response = await axios.post(
    `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/videos`,
    {
      file_url: videoUrl,
      title,
      description,
      access_token: token,
    },
    { timeout: 120000 }
  );

  return response.data;
}

if (require.main === module) {
  const [, , platform, videoUrl, title, description] = process.argv;
  
  if (platform === 'facebook') {
    uploadToFacebookViaAPI(videoUrl, title, description || '')
      .then(r => console.log('SUCCESS:', JSON.stringify(r)))
      .catch(e => console.error('FAIL:', e.response?.data || e.message));
  } else {
    console.log('Usage: node composio-upload.js facebook <url> <title> [description]');
  }
}

module.exports = { uploadToFacebookViaAPI };
