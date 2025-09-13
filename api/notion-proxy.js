// /api/notion-proxy.js - CORRECTED VERSION
const { Client } = require('@notionhq/client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { NOTION_TOKEN, NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID } = process.env;
    if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
      return res.status(500).json({ error: 'Missing environment variables' });
    }
    
    const notion = new Client({ auth: NOTION_TOKEN });
    
    // Projects - FILTER FOR "On The Bench" STATUS
    const projectsResp = await notion.databases.query({ 
      database_id: NOTION_DATABASE_ID,
      filter: {
        property: 'Status',
        select: {
          equals: 'On The Bench'
        }
      }
    });
    
    const projects = projectsResp.results.map(page => ({
      id: page.id,
      name: page.properties?.Name?.title?.[0]?.plain_text ?? 'Untitled',
      instrumentMake: page.properties?.['Instrument Make']?.rich_text?.[0]?.plain_text ?? '',
      instrumentModel: page.properties?.['Instrument Model']?.rich_text?.[0]?.plain_text ?? '',
      complexity: page.properties?.Complexity?.select?.name ?? null,
      profitability: page.properties?.Profitability?.select?.name ?? null,
      status: page.properties?.Status?.select?.name ?? 'Unknown',
      dueDate: page.properties?.['Due Date']?.date?.start ?? null,
      totalMilestones: page.properties?.['Total Milestones']?.rollup?.number ?? 0,
      completedMilestones: page.properties?.['Completed Milestones']?.rollup?.number ?? 0,
      progress: page.properties?.['Progress %']?.formula?.number ?? 0,
      estimatedHours: page.properties?.['Estimated Hours']?.number ?? null,
      totalEstimatedHour: page.properties?.['Total Estimated Hour']?.rollup?.number ?? 0
    }));
    
    // Milestones (optional second DB)
    let milestones = [];
    if (NOTION_MILESTONES_DATABASE_ID) {
      const msResp = await notion.databases.query({ database_id: NOTION_MILESTONES_DATABASE_ID });
      milestones = msResp.results.map(page => ({
        id: page.id,
        projectId: page.properties?.Project?.relation?.[0]?.id || null,
        name: page.properties?.Name?.title?.[0]?.plain_text ?? 'Untitled',
        estimatedHours: Number(page.properties?.EstimatedHours?.number ?? 1),
        order: Number(page.properties?.Order?.number ?? 1),
        status: page.properties?.Status?.status?.name ?? 'Not Started'
      }));
    }
    
    res.status(200).json({ projects, milestones });
    
  } catch (err) {
    console.error('Notion proxy error:', err);
    res.status(500).json({ 
      error: 'Internal server error', 
      detail: err?.message || String(err)
    });
  }
};
