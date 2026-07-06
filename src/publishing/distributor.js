/**
 * CONTENT DISTRIBUTOR V12 - VIDEO-ONLY DUAL PLATFORM
 * 
 * DISTRIBUTION MAP:
 * - Midlife Reset content -> YouTube (@michelgonzalez-q4o) via Composio YOUTUBE_MULTIPART_UPLOAD_VIDEO
 * - Cuba content -> Facebook (Patria y Vida, Page ID: 117307510398180) via Composio FACEBOOK_CREATE_VIDEO_POST
 * 
 * RULES:
 * - ONLY publish videos (no images, no text-only)
 * - Every post includes Amazon affiliate link + midliferesetlab.com CTA
 * - 7 videos/day total: 4 Midlife (YouTube) + 3 Cuba (Facebook)
 */

const axios = require('axios');

const FB_PAGE_ID = '117307510398180';
const AMAZON_LINK = 'https://amzn.to/midlifereset';
const WEB_LINK = 'https://midliferesetlab.com';
const SHOPIFY_LINK = 'https://mildeliferesetlab.myshopify.com';

/**
 * Upload video to YouTube via direct API call
 * Uses YouTube Data API v3 with OAuth token
 */
async function publishToYouTube(item) {
  console.log(`  📺 Publishing to YouTube: ${item.metadata.title}`);

  if (!item.video_url) {
    console.log('  ❌ BLOCKED: No video URL - cannot upload');
    return { platform: 'youtube', status: 'blocked_no_video' };
  }

  try {
    // Build description with all CTAs
    const fullDescription = [
      item.metadata.description,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `🔗 FREE Midlife Reset Blueprint: ${WEB_LINK}`,
      `🛒 Shop Tools & Resources: ${SHOPIFY_LINK}`,
      `📚 My Top Recommendations: ${AMAZON_LINK}`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '#MidlifeResetLab #WomenOver40 #Reinvention #SecondAct #FitnessOver40 #FinancialFreedom',
      '',
      '© 2026 Midlife Reset Lab | midliferesetlab.com',
    ].join('\n');

    // Use Composio YouTube integration via webhook/API
    // The GitHub Action will use the Composio SDK to call YOUTUBE_MULTIPART_UPLOAD_VIDEO
    const uploadPayload = {
      action: 'YOUTUBE_MULTIPART_UPLOAD_VIDEO',
      params: {
        title: item.metadata.title,
        description: fullDescription,
        categoryId: '22', // People & Blogs
        privacyStatus: 'public',
        tags: [...(item.metadata.tags || []), 'MidlifeResetLab', 'WomenOver40', 'Reinvention'],
        videoFile: {
          name: `midlife_${Date.now()}.mp4`,
          mimetype: 'video/mp4',
          url: item.video_url,
        },
      },
    };

    // Option 1: Direct YouTube API upload if refresh token available
    if (process.env.YOUTUBE_REFRESH_TOKEN) {
      const result = await uploadViaYouTubeAPI(item, fullDescription);
      return result;
    }

    // Option 2: Zapier webhook for YouTube upload
    if (process.env.ZAPIER_YOUTUBE_WEBHOOK) {
      const response = await axios.post(process.env.ZAPIER_YOUTUBE_WEBHOOK, uploadPayload, {
        timeout: 30000,
      });
      console.log(`  ✅ YouTube upload triggered via Zapier`);
      return { platform: 'youtube', status: 'published', data: response.data };
    }

    // Option 3: Store for manual/scheduled Composio upload
    console.log(`  📋 YouTube upload queued (no webhook configured)`);
    return { platform: 'youtube', status: 'queued', payload: uploadPayload };

  } catch (e) {
    console.error(`  ❌ YouTube upload failed: ${e.message}`);
    return { platform: 'youtube', status: 'failed', error: e.message };
  }
}

/**
 * Direct YouTube Data API upload using OAuth refresh token
 */
async function uploadViaYouTubeAPI(item, description) {
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  // Get access token
  const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const accessToken = tokenResponse.data.access_token;

  // Download video to buffer
  const videoResponse = await axios.get(item.video_url, {
    responseType: 'arraybuffer',
    timeout: 120000,
  });

  // Upload to YouTube
  const metadata = {
    snippet: {
      title: item.metadata.title,
      description,
      tags: [...(item.metadata.tags || []), 'MidlifeResetLab', 'WomenOver40'],
      categoryId: '22',
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
    },
  };

  // Resumable upload initiation
  const initResponse = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    metadata,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Length': videoResponse.data.length,
        'X-Upload-Content-Type': 'video/mp4',
      },
    }
  );

  const uploadUrl = initResponse.headers.location;

  // Upload video data
  const uploadResponse = await axios.put(uploadUrl, videoResponse.data, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'video/mp4',
      'Content-Length': videoResponse.data.length,
    },
    maxContentLength: 500 * 1024 * 1024,
    timeout: 300000,
  });

  const videoId = uploadResponse.data.id;
  console.log(`  ✅ YouTube video uploaded: https://youtube.com/watch?v=${videoId}`);
  return { platform: 'youtube', status: 'published', videoId, url: `https://youtube.com/watch?v=${videoId}` };
}

/**
 * Upload video to Facebook Page via Graph API
 * Page: Patria y Vida (ID: 117307510398180)
 */
async function publishToFacebook(item) {
  console.log(`  📘 Publishing to Facebook: ${item.metadata.title}`);

  if (!item.video_url) {
    console.log('  ❌ BLOCKED: No video URL - cannot upload');
    return { platform: 'facebook', status: 'blocked_no_video' };
  }

  const token = process.env.FACEBOOK_PAGE_TOKEN;
  if (!token) {
    // Fallback to Zapier
    if (process.env.ZAPIER_WEBHOOK_URL) {
      await axios.post(process.env.ZAPIER_WEBHOOK_URL, {
        action: 'FACEBOOK_CREATE_VIDEO_POST',
        page_id: FB_PAGE_ID,
        video_url: item.video_url,
        description: item.script,
        title: item.metadata.title,
      });
      return { platform: 'facebook', status: 'sent_to_zapier' };
    }
    console.log('  ⚠️ No Facebook token or webhook - skipping');
    return { platform: 'facebook', status: 'no_credentials' };
  }

  try {
    // Build description with CTAs
    const fullDescription = [
      item.script.substring(0, 500),
      '',
      `🇨🇺 ${item.amazon_cta || ''}`,
      `${item.web_cta || ''}`,
      '',
      '#PatriayVida #Cuba #CubaLibre #Libertad #DiasporaCubana',
    ].join('\n');

    // Facebook Video Upload via file_url
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/videos`,
      {
        file_url: item.video_url,
        description: fullDescription,
        title: item.metadata.title,
        access_token: token,
      },
      { timeout: 120000 }
    );

    const videoId = response.data.id;
    console.log(`  ✅ Facebook video posted: ${videoId}`);

    // Add affiliate comment
    await addAffiliateComment(videoId, token, item.type);

    return { platform: 'facebook', status: 'published', videoId };

  } catch (e) {
    console.error(`  ❌ Facebook post failed: ${e.response?.data?.error?.message || e.message}`);
    return { platform: 'facebook', status: 'failed', error: e.message };
  }
}

/**
 * Add monetization comment with Amazon affiliate link
 */
async function addAffiliateComment(postId, token, contentType) {
  const messages = {
    midlife_reset: `🎁 FREE resources for your reset journey!\n\n📚 My top book picks: ${AMAZON_LINK}\n🌐 Free Blueprint: ${WEB_LINK}\n🛒 Shop tools: ${SHOPIFY_LINK}\n\n💫 Your best chapter starts NOW!`,
    cuba_content: `🇨🇺 ¡Apoya nuestra comunidad!\n\n📚 Recomendaciones: ${AMAZON_LINK}\n🌐 Más contenido: ${WEB_LINK}\n\n💪 Juntos por Cuba libre. ¡Patria y Vida!`,
  };

  try {
    await axios.post(`https://graph.facebook.com/v19.0/${postId}/comments`, {
      message: messages[contentType] || messages.cuba_content,
      access_token: token,
    });
    console.log(`  💬 Affiliate comment added`);
  } catch (e) {
    console.log(`  ⚠️ Comment failed: ${e.message}`);
  }
}

/**
 * MAIN: Distribute all generated content to correct platforms
 */
async function distributeContent(generatedContent) {
  const results = { published: 0, failed: 0, blocked: 0, platforms: [] };

  console.log('\n  📤 DISTRIBUTOR V12 - DUAL PLATFORM VIDEO ENGINE');
  console.log(`  📋 Items to publish: ${generatedContent?.length || 0}`);
  console.log(`  📺 YouTube: Midlife Reset Lab | 📘 Facebook: Patria y Vida\n`);

  if (!generatedContent || generatedContent.length === 0) {
    console.log('  No content to distribute');
    return results;
  }

  for (const item of generatedContent) {
    if (!item.has_media || !item.video_url) {
      console.log(`  ⛔ Skipped (no video): ${item.topic?.substring(0, 30)}...`);
      results.blocked++;
      continue;
    }

    let result;

    // Route based on content type
    if (item.type === 'midlife_reset') {
      result = await publishToYouTube(item);
    } else if (item.type === 'cuba_content') {
      result = await publishToFacebook(item);
    }

    if (result) {
      results.platforms.push(result);
      if (result.status === 'published' || result.status === 'sent_to_zapier') {
        results.published++;
        console.log(`  ✅ Published: ${item.topic?.substring(0, 30)}...`);
      } else {
        results.failed++;
      }
    }

    // Rate limit: 5s between uploads
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Report to Zapier
  if (process.env.ZAPIER_WEBHOOK_URL) {
    try {
      await axios.post(process.env.ZAPIER_WEBHOOK_URL, {
        action: 'v12_distribution_cycle',
        timestamp: new Date().toISOString(),
        published: results.published,
        failed: results.failed,
        blocked: results.blocked,
        platforms: results.platforms.map(p => ({ platform: p.platform, status: p.status })),
      });
    } catch (e) { /* silent */ }
  }

  console.log(`\n  📊 Distribution Summary:`);
  console.log(`     Published: ${results.published} | Failed: ${results.failed} | Blocked: ${results.blocked}`);

  return results;
}

module.exports = { distributeContent, publishToYouTube, publishToFacebook };
