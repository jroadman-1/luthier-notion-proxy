// /api/notion-proxy.js - DIAGNOSTIC VERSION
const { Client } = require('@notionhq/client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { NOTION_TOKEN, NOTION_DATABASE_ID } = process.env;
    if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
      return res.status(500).json({ error: 'Missing environment variables' });
    }
    
    const notion = new Client({ auth: NOTION_TOKEN });
    
    // First, let's get the database schema to see actual property names
    const database = await notion.databases.retrieve({ database_id: NOTION_DATABASE_ID });
    const propertyNames = Object.keys(database.properties);
    
    // Get first few projects WITHOUT filtering to see the structure
    const projectsResp = await notion.databases.query({ 
      database_id: NOTION_DATABASE_ID,
      page_size: 5 // Just get 5 projects for diagnosis
    });
    
    // Extract all unique status values
    const statusValues = projectsResp.results.map(page => {
      return page.properties?.Status?.status?.name || 'NO_STATUS';
    });
    const uniqueStatuses = [...new Set(statusValues)];
    
    // Return diagnostic info
    res.status(200).json({ 
      diagnostic: true,
      propertyNames: propertyNames,
      uniqueStatuses: uniqueStatuses,
      sampleProject: projectsResp.results[0]?.properties || {},
      totalProjects: projectsResp.results.length
    });
    
  } catch (err) {
    console.error('Notion proxy error:', err);
    res.status(500).json({ 
      error: 'Internal server error', 
      detail: err?.message || String(err),
      stack: err?.stack
    });
  }
};
