/**
 * HUBSPOT LEAD MANAGER - Funnel optimization & lead nurturing
 * Uses: HUBSPOT_API_KEY
 */

const axios = require('axios');

const HUBSPOT_BASE = 'https://api.hubapi.com';

function getHeaders() {
  const apiKey = process.env.HUBSPOT_API_KEY;
  if (!apiKey) throw new Error('HUBSPOT_API_KEY must be set');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

async function getRecentContacts() {
  try {
    const response = await axios.get(
      `${HUBSPOT_BASE}/crm/v3/objects/contacts?limit=50&sorts=-createdate`,
      { headers: getHeaders() }
    );
    return response.data.results || [];
  } catch (e) {
    console.error(`  HubSpot contacts error: ${e.message}`);
    return [];
  }
}

async function updateContactStage(contactId, stage) {
  try {
    await axios.patch(
      `${HUBSPOT_BASE}/crm/v3/objects/contacts/${contactId}`,
      { properties: { lifecyclestage: stage } },
      { headers: getHeaders() }
    );
    return true;
  } catch (e) {
    console.error(`  Update contact ${contactId} failed: ${e.message}`);
    return false;
  }
}

async function getDeals() {
  try {
    const response = await axios.get(
      `${HUBSPOT_BASE}/crm/v3/objects/deals?limit=50`,
      { headers: getHeaders() }
    );
    return response.data.results || [];
  } catch (e) {
    console.error(`  HubSpot deals error: ${e.message}`);
    return [];
  }
}

async function managLeads() {
  console.log('  Lead management cycle starting...');
  
  const contacts = await getRecentContacts();
  const deals = await getDeals();
  
  // Segment new leads for nurturing
  const newLeads = contacts.filter(c => {
    const created = new Date(c.properties?.createdate);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return created > dayAgo;
  });

  console.log(`  Total contacts: ${contacts.length}`);
  console.log(`  New leads (24h): ${newLeads.length}`);
  console.log(`  Active deals: ${deals.length}`);

  // Calculate funnel metrics
  const metrics = {
    totalContacts: contacts.length,
    newLeads24h: newLeads.length,
    activeDeals: deals.length,
    conversionRate: contacts.length > 0 
      ? ((deals.length / contacts.length) * 100).toFixed(2) + '%' 
      : '0%',
  };

  return metrics;
}

module.exports = { managLeads };
