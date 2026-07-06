/**
 * HeyGen Video Status Checker - Standalone utility
 * Use: node src/content/heygen-status.js <video_id>
 */

const axios = require('axios');

async function checkVideoStatus(videoId) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error('HEYGEN_API_KEY required');

  const response = await axios.get(
    `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
    { headers: { 'X-Api-Key': apiKey } }
  );

  return response.data;
}

if (require.main === module) {
  const videoId = process.argv[2];
  if (!videoId) {
    console.log('Usage: node heygen-status.js <video_id>');
    process.exit(1);
  }
  checkVideoStatus(videoId)
    .then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(e => console.error(e.message));
}

module.exports = { checkVideoStatus };
