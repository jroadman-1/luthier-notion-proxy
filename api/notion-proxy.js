// Full API with enhanced debugging
const { Client } = require('@notionhq/client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { NOTION_TOKEN, NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID, NOTION_WORKFLOWS_DATABASE_ID } = process.env;
    
    console.log('API called:', req.method, req.url, req.query);
    console.log('Environment check:', {
      hasToken: !!NOTION_TOKEN,
      hasProjectsDb: !!NOTION_DATABASE_ID,
      hasMilestonesDb: !!NOTION_MILESTONES_DATABASE_ID,
      hasWorkflowsDb: !!NOTION_WORKFLOWS_DATABASE_ID
    });
    
    if (!NOTION_TOKEN || !NOTION_DATABASE_ID || !NOTION_MILESTONES_DATABASE_ID) {
      console.error('Missing environment variables');
      return res.status(500).json({ error: 'Missing required environment variables' });
    }
    
    const notion = new Client({ auth: NOTION_TOKEN });
    
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, notion);
      case 'POST':
        return await handlePost(req, res, notion);
      case 'PUT':
        return await handlePut(req, res, notion);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (err) {
    console.error('Top-level error:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error', 
        detail: err?.message || String(err)
      });
    }
  }
};

async function handleGet(req, res, notion) {
  const { action } = req.query;
  const { NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID, NOTION_WORKFLOWS_DATABASE_ID } = process.env;
  
  console.log('GET request, action:', action);
  
  switch (action) {
    case 'workflows':
      return await getWorkflows(res, notion, NOTION_WORKFLOWS_DATABASE_ID);
    case 'test':
      return res.json({ success: true, message: 'Test endpoint working' });
    default:
      return await getAllData(res, notion, NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID);
  }
}

async function handlePost(req, res, notion) {
  const { action } = req.query;
  const data = req.body;
  
  console.log('POST request:', action);
  return res.json({ success: true, message: 'POST endpoints not implemented yet' });
}

async function handlePut(req, res, notion) {
  const { action } = req.query;
  const data = req.body;
  
  console.log('PUT request:', action);
  return res.json({ success: true, message: 'PUT endpoints not implemented yet' });
}

// Get all projects and milestones
async function getAllData(res, notion, projectsDbId, milestonesDbId) {
  try {
    console.log('getAllData called with:', { projectsDbId, milestonesDbId });
    
    // Test projects database access
    console.log('Querying projects database...');
    const projectsResponse = await notion.databases.query({
      database_id: projectsDbId,
      filter: {
        property: 'Status',
        select: {
          equals: 'On The Bench'
        }
      },
      page_size: 10 // Start small for testing
    });
    
    console.log('Projects query result:', {
      count: projectsResponse.results.length,
      hasMore: projectsResponse.has_more
    });
    
    // Test milestones database access
    console.log('Querying milestones database...');
    const milestonesResponse = await notion.databases.query({
      database_id: milestonesDbId,
      page_size: 10 // Start small for testing
    });
    
    console.log('Milestones query result:', {
      count: milestonesResponse.results.length,
      hasMore: milestonesResponse.has_more
    });
    
    // Log first project and milestone if they exist
    if (projectsResponse.results.length > 0) {
      console.log('Sample project properties:', Object.keys(projectsResponse.results[0].properties));
    }
    
    if (milestonesResponse.results.length > 0) {
      console.log('Sample milestone properties:', Object.keys(milestonesResponse.results[0].properties));
    }
    
    const projects = projectsResponse.results.map(mapProject);
    const milestones = milestonesResponse.results.map(mapMilestone);
    
    console.log(`Returning ${projects.length} projects and ${milestones.length} milestones`);
    
    return res.json({ projects, milestones });
    
  } catch (error) {
    console.error('getAllData error:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    throw new Error(`Failed to fetch data: ${error.message}`);
  }
}

// Get workflow templates
async function getWorkflows(res, notion, workflowsDbId) {
  if (!workflowsDbId) {
    console.log('No workflows database ID provided');
    return res.json({ workflows: [] });
  }
  
  try {
    console.log('Fetching workflows from:', workflowsDbId);
    
    const response = await notion.databases.query({
      database_id: workflowsDbId,
      page_size: 10
    });
    
    console.log('Workflows found:', response.results.length);
    
    const workflows = response.results.map(page => ({
      id: page.id,
      name: page.properties?.Name?.title?.[0]?.plain_text ?? 'Untitled',
      data: page.properties?.Data?.rich_text?.[0]?.plain_text ?? '[]'
    }));
    
    return res.json({ workflows });
  } catch (error) {
    console.error('Workflows error:', error.message);
    return res.json({ workflows: [], error: error.message });
  }
}

// Mapping functions
function mapProject(page) {
  const props = page.properties;
  
  return {
    id: page.id,
    name: props.Name?.title?.[0]?.plain_text ?? 'Untitled',
    instrumentMake: props['Instrument Make']?.rich_text?.[0]?.plain_text ?? '',
    instrumentModel: props['Instrument Model']?.rich_text?.[0]?.plain_text ?? '',
    complexity: parseRatingValue(props.Complexity?.select?.name),
    profitability: parseRatingValue(props.Profitability?.select?.name),
    status: props.Status?.select?.name ?? 'Unknown',
    dueDate: props['Due Date']?.date?.start ?? null,
    lastWorked: props['Last Worked']?.date?.start ?? null,
    totalMilestones: props['Total Milestones']?.rollup?.number ?? 0,
    completedMilestones: props['Completed Milestones']?.rollup?.number ?? 0,
    progress: props['Progress %']?.formula?.number ?? 0,
    totalEstimatedHour: props['Total Estimated Hour']?.rollup?.number ?? 0
  };
}

function mapMilestone(page) {
  const props = page.properties;
  
  return {
    id: page.id,
    projectId: props['Work Order']?.relation?.[0]?.id || null,
    name: props.Name?.title?.[0]?.plain_text ?? 'Untitled',
    estimatedHours: props['Estimated Hours']?.number ?? 1,
    actualHours: props['Actual Hours']?.number ?? 0,
    order: props['Order (Sequence)']?.number ?? 1,
    status: props.Status?.select?.name ?? 'Not Started',
    milestoneType: props['Milestone Type']?.select?.name ?? 'Individual',
    dueDate: props['Due Date']?.date?.start ?? null,
    notes: props.Notes?.rich_text?.[0]?.plain_text ?? ''
  };
}

function parseRatingValue(ratingStr) {
  if (!ratingStr) return 3;
  if (typeof ratingStr === 'number') return ratingStr;
  const match = ratingStr.match(/^(\d+)-/);
  return match ? parseInt(match[1]) : 3;
}
