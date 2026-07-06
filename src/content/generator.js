/**
 * CONTENT GENERATOR V12 - HEYGEN VIDEO-ONLY ENGINE
 * ZERO STATIC IMAGES. Every post = HeyGen AI video.
 * 
 * Voice: Mateo (2d5b0e6cfbd34550bc40d6c66b8d7a12)
 * Talking Photo: baed4e6bc0d946eb81c3e22e69f2742e
 * 
 * Flow: OpenAI generates script -> HeyGen creates video -> Returns video_id for polling
 */

const OpenAI = require('openai');
const axios = require('axios');

// === HEYGEN CONFIG ===
const HEYGEN_BASE_URL = 'https://api.heygen.com/v2/video/generate';
const HEYGEN_STATUS_URL = 'https://api.heygen.com/v1/video_status.get';
const VOICE_ID_ENGLISH = 'Vgdihz1vTYXMr9BMj8OZ'; // Warm Cuban Baritone (English)
const VOICE_ID_SPANISH = '626ca51acb2e496f8dcee8d7591fda3c'; // Narrator Mateo (Spanish) // Mateo
const TALKING_PHOTO_ID = 'baed4e6bc0d946eb81c3e22e69f2742e';

// === BACKGROUND IMAGES (rotate for variety) ===
const BG_IMAGES = {
  midlife: [
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&h=1080&fit=crop', // fitness woman
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1920&h=1080&fit=crop', // sunrise motivation
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1920&h=1080&fit=crop', // yoga peace
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1920&h=1080&fit=crop', // journal planning
  ],
  cuba: [
    'https://images.unsplash.com/photo-1500759285222-a95626b934cb?w=1920&h=1080&fit=crop', // havana street
    'https://images.unsplash.com/photo-1570299437522-462e48eca8ea?w=1920&h=1080&fit=crop', // cuban flag
    'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=1920&h=1080&fit=crop', // caribbean coast
    'https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1920&h=1080&fit=crop', // vintage havana
  ],
};

// === TOPICS ===
const MIDLIFE_TOPICS = [
  'reinvención después de los 40 - cómo empezar de cero y triunfar',
  'segundo acto profesional - historias de mujeres que lo lograron',
  'bienestar emocional en la mediana edad - secretos que nadie te dice',
  'fitness transformador para mujeres 40+ - rutinas que cambian tu cuerpo',
  'emprendimiento en la madurez - de empleada a CEO a los 50',
  'finanzas personales para mujeres independientes - libertad financiera real',
  'menopausia y vitalidad - rompe el tabú y vive tu mejor etapa',
  'autoestima y confianza a los 50 - descubre tu poder interior',
  'nutrición anti-edad basada en ciencia - secretos de longevidad',
  'tecnología para mujeres 50+ - domina el mundo digital sin miedo',
  'relaciones saludables - reconstruye tu vida amorosa con confianza',
  'networking para profesionales maduras - conexiones que generan ingresos',
  'salud mental y mindfulness - paz interior y productividad',
  'moda y estilo para mujeres reales - auténtica a cualquier edad',
  'hijos adultos y nido vacío - tu momento de brillar ha llegado',
];

const CUBA_TOPICS = [
  'la realidad de Cuba hoy - lo que los medios no muestran',
  'economía cubana en crisis - impacto en las familias',
  'diáspora cubana 2026 - historias de superación y éxito',
  'libertad de expresión en Cuba - voces que no se callan',
  'emprendedores cubanos - innovación contra todo pronóstico',
  'remesas y economía familiar - la realidad del día a día',
  'migración cubana - testimonios reales de valentía',
  'cultura cubana inmortal - orgullo que nadie puede quitar',
  'Cuba y tecnología - la revolución digital silenciosa',
  'solidaridad cubana en el exilio - unidos por la patria',
];

function getOpenAI() {
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, ...(baseURL && { baseURL }) });
}

function getHeyGenKey() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error('HEYGEN_API_KEY required');
  return key;
}

/**
 * Generate a video script optimized for 60-90 second talking head videos
 */
async function generateVideoScript(openai, topic, type) {
  const systemPrompts = {
    midlife_reset: `You are the voice of Midlife Reset Lab - a transformational movement for women 40-60.
You create 60-second video scripts that feel like a warm, wise friend speaking directly to the viewer.
Rules:
- Speak in FIRST PERSON as Michel (male coach, empathetic, authoritative)
- Open with a HOOK that stops the scroll (question or bold statement)
- Share ONE powerful insight or mini-story
- Close with a clear CTA to midliferesetlab.com
- Tone: warm, motivating, real (not toxic positivity)
- Length: EXACTLY 120-180 words (60-90 seconds when spoken)
- Language: English (target audience: US women 40-60)
- Include Amazon product mention naturally (books, fitness gear, journals)
- End with: "Visit midliferesetlab.com to start your reset today"`,
    
    cuba_content: `Eres la voz de "Patria y Vida" - un canal informativo para cubanos.
Creas guiones de video de 60 segundos que informan con empatía y verdad.
Reglas:
- Habla en PRIMERA PERSONA como Michel (cubano, empático, informado)
- Abre con un GANCHO que pare el scroll
- Comparte UNA noticia o reflexión poderosa
- Cierra con llamado a la comunidad
- Tono: informativo, empático, esperanzador pero realista
- Largo: EXACTAMENTE 120-180 palabras (60-90 segundos al hablar)
- Idioma: Español cubano natural
- Termina con: "Síguenos y comparte para que Cuba sea libre. Patria y Vida."`,
  };

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompts[type] },
      { role: 'user', content: `Create a video script about: ${topic}\n\nReturn ONLY the spoken text, no stage directions, no formatting. Just the words the person will say on camera.` },
    ],
    max_tokens: 400,
    temperature: 0.85,
  });

  return response.choices[0].message.content.trim();
}

/**
 * Generate video title and description for platform upload
 */
async function generateMetadata(openai, topic, type, script) {
  const lang = type === 'cuba_content' ? 'Spanish' : 'English';
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `Generate YouTube/Facebook video metadata in ${lang}. Return JSON only.` },
      { role: 'user', content: `Topic: ${topic}\nScript preview: ${script.substring(0, 200)}\n\nReturn JSON: {"title": "catchy title under 60 chars", "description": "SEO description 150-200 words with hashtags", "tags": ["tag1","tag2","tag3","tag4","tag5"]}` },
    ],
    max_tokens: 400,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch (e) {
    return {
      title: topic.substring(0, 60),
      description: script.substring(0, 200),
      tags: ['midliferesetlab', 'reinvention', 'women40plus'],
    };
  }
}

/**
 * Submit video generation to HeyGen API
 * Returns video_id for status polling
 */
async function submitHeyGenVideo(script, type, topic) {
  const apiKey = getHeyGenKey();
  const bgImages = type === 'cuba_content' ? BG_IMAGES.cuba : BG_IMAGES.midlife;
  const bgUrl = bgImages[Math.floor(Math.random() * bgImages.length)];
  
  // YouTube = 16:9 landscape, Facebook Reels = 9:16 portrait
  const dimension = type === 'midlife_reset' 
    ? { width: 1920, height: 1080 }  // YouTube landscape
    : { width: 1080, height: 1920 }; // Facebook portrait/Reels

  const payload = {
    video_inputs: [
      {
        character: {
          type: 'talking_photo',
          talking_photo_id: TALKING_PHOTO_ID,
        },
        voice: {
          type: 'text',
          input_text: script,
          voice_id: type === 'cuba_content' ? VOICE_ID_SPANISH : VOICE_ID_ENGLISH,
        },
        background: {
          type: 'image',
          url: bgUrl,
        },
      },
    ],
    dimension,
    title: `V12_${type}_${Date.now()}`,
  };

  const response = await axios.post(HEYGEN_BASE_URL, payload, {
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  if (response.data?.data?.video_id) {
    console.log(`    🎬 HeyGen video submitted: ${response.data.data.video_id}`);
    return response.data.data.video_id;
  }

  throw new Error(`HeyGen submission failed: ${JSON.stringify(response.data)}`);
}

/**
 * Poll HeyGen for video completion (with exponential backoff)
 * Returns video URL when ready
 */
async function pollHeyGenVideo(videoId, maxAttempts = 30) {
  const apiKey = getHeyGenKey();
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const waitTime = Math.min(attempt * 10000, 60000); // 10s, 20s, 30s... max 60s
    await new Promise(resolve => setTimeout(resolve, waitTime));

    try {
      const response = await axios.get(`${HEYGEN_STATUS_URL}?video_id=${videoId}`, {
        headers: { 'X-Api-Key': apiKey },
        timeout: 15000,
      });

      const status = response.data?.data?.status;
      const videoUrl = response.data?.data?.video_url;

      if (status === 'completed' && videoUrl) {
        console.log(`    ✅ Video ready (attempt ${attempt}): ${videoUrl.substring(0, 60)}...`);
        return videoUrl;
      } else if (status === 'failed') {
        throw new Error(`HeyGen video failed: ${JSON.stringify(response.data?.data?.error)}`);
      }

      console.log(`    ⏳ Video status: ${status} (attempt ${attempt}/${maxAttempts})`);
    } catch (e) {
      if (e.message.includes('failed')) throw e;
      console.log(`    ⚠️ Poll error (attempt ${attempt}): ${e.message}`);
    }
  }

  throw new Error(`Video ${videoId} timed out after ${maxAttempts} attempts`);
}

/**
 * MAIN: Generate all content for one cycle
 * Returns array of video items ready for distribution
 */
async function generateContent() {
  const openai = getOpenAI();
  const content = [];

  console.log('\n  🎬 CONTENT GENERATOR V12 - HEYGEN VIDEO ENGINE');
  console.log('  📋 Mode: ZERO STATIC IMAGES - ALL VIDEOS');
  console.log(`  🗣️ Voice: Mateo (${VOICE_ID})`);
  console.log(`  📸 Avatar: ${TALKING_PHOTO_ID}\n`);

  // Select topics for this cycle
  const midlifeTopics = MIDLIFE_TOPICS.sort(() => Math.random() - 0.5).slice(0, 4);
  const cubaTopics = CUBA_TOPICS.sort(() => Math.random() - 0.5).slice(0, 3);

  // Generate Midlife Reset videos (for YouTube)
  for (const topic of midlifeTopics) {
    try {
      console.log(`  📝 Generating script: ${topic.substring(0, 45)}...`);
      const script = await generateVideoScript(openai, topic, 'midlife_reset');
      const metadata = await generateMetadata(openai, topic, 'midlife_reset', script);
      
      console.log(`  🎬 Submitting to HeyGen...`);
      const videoId = await submitHeyGenVideo(script, 'midlife_reset', topic);
      
      content.push({
        topic,
        script,
        metadata,
        type: 'midlife_reset',
        platform: 'youtube',
        heygen_video_id: videoId,
        video_url: null, // Will be filled after polling
        has_media: true,
        amazon_cta: '🔗 Tools I recommend: https://amzn.to/midlifereset',
        web_cta: '🌐 Start your reset: https://midliferesetlab.com',
        shopify_cta: '🛒 Shop: https://mildeliferesetlab.myshopify.com',
      });
      
      console.log(`  ✓ [MIDLIFE VIDEO] ${topic.substring(0, 40)}...`);
      
      // Rate limit: wait 5s between HeyGen submissions
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (e) {
      console.error(`  ✗ Failed: ${topic} - ${e.message}`);
    }
  }

  // Generate Cuba content videos (for Facebook)
  for (const topic of cubaTopics) {
    try {
      console.log(`  📝 Generating script: ${topic.substring(0, 45)}...`);
      const script = await generateVideoScript(openai, topic, 'cuba_content');
      const metadata = await generateMetadata(openai, topic, 'cuba_content', script);
      
      console.log(`  🎬 Submitting to HeyGen...`);
      const videoId = await submitHeyGenVideo(script, 'cuba_content', topic);
      
      content.push({
        topic,
        script,
        metadata,
        type: 'cuba_content',
        platform: 'facebook',
        heygen_video_id: videoId,
        video_url: null,
        has_media: true,
        amazon_cta: '🔗 Recomendaciones: https://amzn.to/midlifereset',
        web_cta: '🌐 Más info: https://midliferesetlab.com',
      });
      
      console.log(`  ✓ [CUBA VIDEO] ${topic.substring(0, 40)}...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (e) {
      console.error(`  ✗ Failed: ${topic} - ${e.message}`);
    }
  }

  // Now poll all videos for completion
  console.log(`\n  ⏳ Waiting for ${content.length} videos to render...`);
  
  for (const item of content) {
    try {
      const videoUrl = await pollHeyGenVideo(item.heygen_video_id);
      item.video_url = videoUrl;
      console.log(`  ✅ Ready: ${item.topic.substring(0, 35)}...`);
    } catch (e) {
      console.error(`  ❌ Video render failed: ${item.topic.substring(0, 35)} - ${e.message}`);
      item.has_media = false;
    }
  }

  // Filter out failed videos
  const readyContent = content.filter(c => c.video_url && c.has_media);
  
  console.log(`\n  📊 Videos ready: ${readyContent.length}/${content.length}`);
  console.log(`  🎯 Zero static images - all HeyGen videos\n`);

  return { totalGenerated: readyContent.length, content: readyContent };
}

module.exports = { generateContent, submitHeyGenVideo, pollHeyGenVideo, generateVideoScript };
