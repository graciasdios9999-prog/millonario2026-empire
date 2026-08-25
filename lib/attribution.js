/**
 * Content → commerce attribution keys.
 */
'use strict';

const crypto = require('crypto');

function buildTrackingParams(input) {
  const i = input || {};
  const campaign_id = i.campaign_id || i.campaignId || 'camp_' + crypto.randomBytes(4).toString('hex');
  const source = i.source || 'organic';
  const product_id = i.product_id || i.productId || null;
  const offer_id = i.offer_id || i.offerId || null;
  const content_id = i.content_id || i.contentId || null;
  const utm = {
    utm_source: source,
    utm_medium: i.medium || 'content',
    utm_campaign: campaign_id,
    utm_content: content_id || undefined,
  };
  return {
    campaign_id,
    source,
    product_id,
    offer_id,
    content_id,
    utm,
    query_string:
      'utm_source=' +
      encodeURIComponent(utm.utm_source) +
      '&utm_medium=' +
      encodeURIComponent(utm.utm_medium) +
      '&utm_campaign=' +
      encodeURIComponent(utm.utm_campaign) +
      (content_id ? '&utm_content=' + encodeURIComponent(content_id) : ''),
  };
}

module.exports = { buildTrackingParams };
