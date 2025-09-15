// Minimal test version - replace your current /api/notion-proxy.js with this temporarily
module.exports = async (req, res) => {
  console.log('Function started');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    console.log('Environment check...');
    const { NOTION_TOKEN, NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID } = process.env;
    
    console.log('Environment variables present:', {
      hasToken: !!NOTION_TOKEN,
      hasProjectsDb: !!NOTION_DATABASE_ID,
      hasMilestonesDb: !!NOTION_MILESTONES_DATABASE_ID
    });
    
    // Test basic Notion client creation
    console.log('Testing Notion client...');
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: NOTION_TOKEN });
    
    console.log('Notion client created successfully');
    
    return res.json({ 
      success: true,
      message: 'Function is working',
      environment: {
        hasToken: !!NOTION_TOKEN,
        hasProjectsDb: !!NOTION_DATABASE_ID,
        hasMilestonesDb: !!NOTION_MILESTONES_DATABASE_ID,
        tokenLength: NOTION_TOKEN ? NOTION_TOKEN.length : 0
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Test function error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
};
