// /api/notion-proxy.js - Complete system API
const { Client }

// Debug function to check project database schema
async function debugProjectSchema(res, notion, projectsDbId) {
  try {
    console.log('Debugging project database schema...');
    
    const database = await notion.databases.retrieve({
      database_id: projectsDbId
    });
    
    const properties = Object.keys(database.properties).map(key => ({
      name: key,
      type: database.properties[key].type,
      config: database.properties[key]
    }));
    
    console.log('Project database properties:', properties);
    
    // Also get a sample project to see actual data
    const sampleResponse = await notion.databases.query({
      database_id: projectsDbId,
      page_size: 1
    });
    
    let sampleData = null;
    if (sampleResponse.results.length > 0) {
      const sampleProject = sampleResponse.results[0];
      sampleData = {
        id: sampleProject.id,
        properties: Object.keys(sampleProject.properties).reduce((acc, key) => {
          acc[key] = sampleProject.properties[key];
          return acc;
        }, {})
      };
    }
    
    return res.json({ 
      databaseProperties: properties,
      sampleProject: sampleData 
    });
  } catch (error) {
    console.error('Debug project schema error:', error);
    return res.json({ error: error.message });
  } = require('@notionhq/client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { NOTION_TOKEN, NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID, NOTION_WORKFLOWS_DATABASE_ID } = process.env;
    
    if (!NOTION_TOKEN || !NOTION_DATABASE_ID || !NOTION_MILESTONES_DATABASE_ID) {
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
    console.error('Notion proxy error:', err);
    res.status(500).json({ 
      error: 'Internal server error', 
      detail: err?.message || String(err)
    });
  }
};

async function handleGet(req, res, notion) {
  const { action } = req.query;
  const { NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID, NOTION_WORKFLOWS_DATABASE_ID } = process.env;
  
  switch (action) {
    case 'workflows':
      return await getWorkflows(res, notion, NOTION_WORKFLOWS_DATABASE_ID);
    default:
      return await getAllData(res, notion, NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID);
  }
}

async function handlePost(req, res, notion) {
  const { action } = req.query;
  const data = req.body;
  const { NOTION_MILESTONES_DATABASE_ID, NOTION_DATABASE_ID } = process.env;
  
  switch (action) {
    case 'create-milestones':
      return await createMilestones(res, notion, NOTION_MILESTONES_DATABASE_ID, data);
    case 'save-progress':
      return await saveProgress(res, notion, NOTION_MILESTONES_DATABASE_ID, NOTION_DATABASE_ID, data);
    case 'save-milestones':
      return await saveMilestones(res, notion, NOTION_MILESTONES_DATABASE_ID, data);
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handlePut(req, res, notion) {
  const { action } = req.query;
  const data = req.body;
  const { NOTION_MILESTONES_DATABASE_ID, NOTION_DATABASE_ID } = process.env;
  
  switch (action) {
    case 'update-milestone':
      return await updateMilestone(res, notion, NOTION_MILESTONES_DATABASE_ID, data);
    case 'update-project':
      return await updateProject(res, notion, NOTION_DATABASE_ID, data);
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

// Get all projects and milestones for scheduling
async function getAllData(res, notion, projectsDbId, milestonesDbId) {
  try {
    const [projectsResponse, milestonesResponse] = await Promise.all([
      notion.databases.query({
        database_id: projectsDbId,
        filter: {
          property: 'Status',
          select: {
            equals: 'On The Bench'
          }
        },
        page_size: 100 // Ensure we get all projects
      }),
      notion.databases.query({
        database_id: milestonesDbId,
        page_size: 100 // Ensure we get all milestones
      })
    ]);
    
    const projects = projectsResponse.results.map(mapProject);
    const milestones = milestonesResponse.results.map(mapMilestone);
    
    console.log(`API returning ${projects.length} projects and ${milestones.length} milestones`);
    
    return res.json({ projects, milestones });
  } catch (error) {
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
    console.log('Fetching workflows from database:', workflowsDbId);
    
    let allWorkflows = [];
    let hasMore = true;
    let nextCursor = undefined;
    
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: workflowsDbId,
        page_size: 100,
        start_cursor: nextCursor
      });
      
      allWorkflows = allWorkflows.concat(response.results);
      hasMore = response.has_more;
      nextCursor = response.next_cursor;
    }
    
    const workflows = allWorkflows.map(page => {
      const workflow = {
        id: page.id,
        name: page.properties?.Name?.title?.[0]?.plain_text ?? 'Untitled',
        data: page.properties?.Data?.rich_text?.[0]?.plain_text ?? '[]'
      };
      console.log('Mapped workflow:', workflow);
      return workflow;
    });
    
    console.log(`Returning ${workflows.length} workflows`);
    return res.json({ workflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return res.json({ workflows: [], error: error.message });
  }
}

// Create milestones from various sources
async function createMilestones(res, notion, milestonesDbId, data) {
  const { projectId, milestones, source } = data;
  
  try {
    const createdMilestones = [];
    
    for (const milestone of milestones) {
      const response = await notion.pages.create({
        parent: { database_id: milestonesDbId },
        properties: {
          'Name': {
            title: [{ text: { content: milestone.name } }]
          },
          'Work Order': {
            relation: [{ id: projectId }]
          },
          'Estimated Hours': {
            number: milestone.estimatedHours || 1
          },
          'Order (Sequence)': {
            number: milestone.order || 1
          },
          'Status': {
            select: { name: 'Not Started' }
          },
          'Milestone Type': {
            select: { name: source || 'Individual' }
          }
        }
      });
      
      createdMilestones.push(mapMilestone(response));
    }
    
    return res.json({ success: true, milestones: createdMilestones });
  } catch (error) {
    throw new Error(`Failed to create milestones: ${error.message}`);
  }
}

// Save progress (completed milestones and actual hours)
async function saveProgress(res, notion, milestonesDbId, projectsDbId, data) {
  const { completedMilestones } = data;
  
  try {
    const updates = [];
    const projectUpdates = new Set();
    
    for (const completion of completedMilestones) {
      // Update milestone
      const milestoneUpdate = notion.pages.update({
        page_id: completion.milestoneId,
        properties: {
          'Status': {
            select: { name: 'Completed' }
          },
          'Actual Hours': {
            number: completion.actualHours
          }
        }
      });
      
      updates.push(milestoneUpdate);
      projectUpdates.add(completion.projectId);
    }
    
    // Update Last Worked date for affected projects
    const today = new Date().toISOString().split('T')[0];
    for (const projectId of projectUpdates) {
      const projectUpdate = notion.pages.update({
        page_id: projectId,
        properties: {
          'Last Worked': {
            date: { start: today }
          }
        }
      });
      
      updates.push(projectUpdate);
    }
    
    await Promise.all(updates);
    
    return res.json({ success: true, message: 'Progress saved successfully' });
  } catch (error) {
    throw new Error(`Failed to save progress: ${error.message}`);
  }
}

// Update project information
async function updateProject(res, notion, projectsDbId, data) {
  const { projectId, ...updates } = data;
  
  try {
    const properties = {};
    
    if (updates.name) {
      properties.Name = { title: [{ text: { content: updates.name } }] };
    }
    if (updates.status) {
      properties.Status = { select: { name: updates.status } };
    }
    if (updates.instrumentMake !== undefined) {
      properties['Instrument Make'] = { 
        rich_text: [{ text: { content: updates.instrumentMake || '' } }] 
      };
    }
    if (updates.instrumentModel !== undefined) {
      properties['Instrument Model'] = { 
        rich_text: [{ text: { content: updates.instrumentModel || '' } }] 
      };
    }
    if (updates.complexity !== undefined) {
      const complexityValue = `${updates.complexity}-${['Simple','Easy','Moderate','Complex','Very Complex'][updates.complexity-1]}`;
      properties.Complexity = { select: { name: complexityValue } };
    }
    if (updates.profitability !== undefined) {
      const profitabilityValue = `${updates.profitability}-${['Low','Below Average','Standard','Good','Excellent'][updates.profitability-1]}`;
      properties.Profitability = { select: { name: profitabilityValue } };
    }
    if (updates.dueDate !== undefined) {
      properties['Due Date'] = updates.dueDate ? { date: { start: updates.dueDate } } : { date: null };
    }

    await notion.pages.update({
      page_id: projectId,
      properties
    });

    return res.json({ success: true, message: 'Project updated successfully' });
  } catch (error) {
    throw new Error(`Failed to update project: ${error.message}`);
  }
}

// Update single milestone
async function updateMilestone(res, notion, milestonesDbId, data) {
  const { milestoneId, ...updates } = data;
  
  try {
    const properties = {};
    
    if (updates.name) {
      properties.Name = { title: [{ text: { content: updates.name } }] };
    }
    if (updates.estimatedHours !== undefined) {
      properties['Estimated Hours'] = { number: updates.estimatedHours };
    }
    if (updates.actualHours !== undefined) {
      properties['Actual Hours'] = { number: updates.actualHours };
    }
    if (updates.status) {
      properties.Status = { select: { name: updates.status } };
    }
    if (updates.order !== undefined) {
      properties['Order (Sequence)'] = { number: updates.order };
    }
    if (updates.dueDate !== undefined) {
      properties['Due Date'] = updates.dueDate ? { date: { start: updates.dueDate } } : { date: null };
    }
    if (updates.notes !== undefined) {
      properties.Notes = { rich_text: [{ text: { content: updates.notes || '' } }] };
    }

    await notion.pages.update({
      page_id: milestoneId,
      properties
    });

    return res.json({ success: true, message: 'Milestone updated successfully' });
  } catch (error) {
    throw new Error(`Failed to update milestone: ${error.message}`);
  }
}

// Save complete milestone set for a project
async function saveMilestones(res, notion, milestonesDbId, data) {
  const { projectId, milestones } = data;
  
  try {
    // First, get existing milestones for this project
    const existingResponse = await notion.databases.query({
      database_id: milestonesDbId,
      filter: {
        property: 'Work Order',
        relation: {
          contains: projectId
        }
      }
    });
    
    const existingMilestones = existingResponse.results.map(mapMilestone);
    const updates = [];
    
    // Process each milestone
    for (let i = 0; i < milestones.length; i++) {
      const milestone = milestones[i];
      
      if (milestone.id && existingMilestones.find(m => m.id === milestone.id)) {
        // Update existing milestone
        const updatePromise = notion.pages.update({
          page_id: milestone.id,
          properties: {
            'Name': { title: [{ text: { content: milestone.name } }] },
            'Estimated Hours': { number: milestone.estimatedHours },
            'Order (Sequence)': { number: i + 1 },
            'Status': { select: { name: milestone.status || 'Not Started' } }
          }
        });
        updates.push(updatePromise);
      } else {
        // Create new milestone
        const createPromise = notion.pages.create({
          parent: { database_id: milestonesDbId },
          properties: {
            'Name': { title: [{ text: { content: milestone.name } }] },
            'Work Order': { relation: [{ id: projectId }] },
            'Estimated Hours': { number: milestone.estimatedHours },
            'Order (Sequence)': { number: i + 1 },
            'Status': { select: { name: milestone.status || 'Not Started' } },
            'Milestone Type': { select: { name: 'Individual' } }
          }
        });
        updates.push(createPromise);
      }
    }
    
    // Delete milestones that were removed (exist in Notion but not in the new list)
    const milestoneIds = milestones.filter(m => m.id).map(m => m.id);
    const toDelete = existingMilestones.filter(m => !milestoneIds.includes(m.id));
    
    for (const milestone of toDelete) {
      const deletePromise = notion.pages.update({
        page_id: milestone.id,
        archived: true
      });
      updates.push(deletePromise);
    }
    
    await Promise.all(updates);
    
    return res.json({ 
      success: true, 
      message: `Updated ${milestones.length} milestones, deleted ${toDelete.length} milestones`
    });
  } catch (error) {
    throw new Error(`Failed to save milestones: ${error.message}`);
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
