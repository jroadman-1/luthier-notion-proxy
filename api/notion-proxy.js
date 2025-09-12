// /api/notion-proxy.js
const { Client } = require('@notionhq/client');

module.exports = async (req, res) => {
  // CORS (safe default)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { NOTION_TOKEN, NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID } = process.env;
    const missing = [];
    if (!NOTION_TOKEN) missing.push('NOTION_TOKEN');
    if (!NOTION_DATABASE_ID) missing.push('NOTION_DATABASE_ID');
    if (missing.length) return res.status(500).json({ error: 'Missing environment variables', missing });

    const notion = new Client({ auth: NOTION_TOKEN });

    // Projects
    const projectsResp = await notion.databases.query({ database_id: NOTION_DATABASE_ID });
    const projects = projectsResp.results.map(page => ({
      id: page.id,
      name: page.properties?.Name?.title?.[0]?.plain_text ?? 'Untitled',
      instrumentMake: page.properties?.Make?.rich_text?.[0]?.plain_text ?? '',
      instrumentModel: page.properties?.Model?.rich_text?.[0]?.plain_text ?? '',
      complexity: Number(page.properties?.Complexity?.number ?? 3),
      profitability: Number(page.properties?.Profitability?.number ?? 3),
      status: page.properties?.Status?.status?.name ?? 'In Progress',
      dueDate: page.properties?.Due?.date?.start ?? null
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
    res.status(500).json({ error: 'Internal server error', detail: err?.message || String(err) });
  }
};
