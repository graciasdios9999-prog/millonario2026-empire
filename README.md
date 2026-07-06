# CEO-Dios Empire V12 - Autonomous Video Engine

## 🎬 Overview
Fully autonomous video publishing system that generates and publishes **7 AI videos daily** using HeyGen talking-head technology. Zero static images. Zero human intervention.

## Architecture
```
OpenAI (script) → HeyGen (video render) → YouTube/Facebook (distribution)
```

### Distribution Map
| Content Type | Platform | Channel |
|---|---|---|
| Midlife Reset Lab | YouTube | @michelgonzalez-q4o |
| Cuba / Patria y Vida | Facebook | Page ID: 117307510398180 |

### Daily Schedule (7 cycles via GitHub Actions)
- 00:00, 03:25, 06:50, 10:15, 13:40, 17:05, 20:30 UTC
- Each cycle generates 1 video (4 Midlife + 3 Cuba per day)

## HeyGen Config
- **Voice**: Mateo (`2d5b0e6cfbd34550bc40d6c66b8d7a12`)
- **Avatar**: Talking Photo (`baed4e6bc0d946eb81c3e22e69f2742e`)
- **Format**: YouTube = 1920x1080, Facebook = 1080x1920

## Monetization
Every video includes:
- Amazon affiliate link: `https://amzn.to/midlifereset`
- CTA to `midliferesetlab.com`
- Link to Shopify: `mildeliferesetlab.myshopify.com`

## Required Secrets (GitHub Actions)
```
OPENAI_API_KEY          - GPT-4o-mini for scripts
HEYGEN_API_KEY          - Video generation
YOUTUBE_REFRESH_TOKEN   - YouTube upload
YOUTUBE_CLIENT_ID       - OAuth client
YOUTUBE_CLIENT_SECRET   - OAuth secret
FB_PAGE_TOKEN_PATRIA    - Facebook page token
AMAZON_AFFILIATE_LINK   - Affiliate tracking
ZAPIER_WEBHOOK          - Status reporting
ALPACA_API_KEY_ID       - Trading (optional)
ALPACA_SECRET_KEY       - Trading (optional)
```

## Commands
```bash
npm run master-loop     # Full cycle (generate + publish)
npm run content         # Generate videos only
npm run publish         # Publish only
npm run test-cycle      # Validate pipeline
npm run heygen-status   # Check video render status
```

## Version History
- V11: HuggingFace images + Facebook only
- **V12: HeyGen videos + YouTube (Midlife) + Facebook (Cuba)**
