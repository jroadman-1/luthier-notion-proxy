// /api/notion-proxy.js - Complete system API
const { Client } = require('@notionhq/client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
      case 'DELETE':
        return await handleDelete(req, res, notion);
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
    case 'debug-project-schema':
      return await debugProjectSchema(res, notion, NOTION_DATABASE_ID);
    default:
      return await getAllData(res, notion, NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID);
  }
}

async function handlePost(req, res, notion) {
  const { action } = req.query;
  const data = req.body;
  const { NOTION_MILESTONES_DATABASE_ID, NOTION_DATABASE_ID, NOTION_WORKFLOWS_DATABASE_ID } = process.env;
  
  switch (action) {
    case 'create-project':
      return await createProject(res, notion, NOTION_DATABASE_ID, data);
    case 'create-milestones':
      return await createMilestones(res, notion, NOTION_MILESTONES_DATABASE_ID, data);
    case 'save-progress':
      return await saveProgress(res, notion, NOTION_MILESTONES_DATABASE_ID, NOTION_DATABASE_ID, data);
    case 'save-milestones':
      return await saveMilestones(res, notion, NOTION_MILESTONES_DATABASE_ID, data);
    case 'create-workflow':
      return await createWorkflow(res, notion, NOTION_WORKFLOWS_DATABASE_ID, data);
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handlePut(req, res, notion) {
  const { action } = req.query;
  const data = req.body;
  const { NOTION_MILESTONES_DATABASE_ID, NOTION_DATABASE_ID, NOTION_WORKFLOWS_DATABASE_ID } = process.env;
  
  switch (action) {
    case 'update-milestone':
      return await updateMilestone(res, notion, NOTION_MILESTONES_DATABASE_ID, data);
    case 'update-project':
      return await updateProject(res, notion, NOTION_DATABASE_ID, data);
    case 'update-workflow':
      return await updateWorkflow(res, notion, NOTION_WORKFLOWS_DATABASE_ID, data);
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handleDelete(req, res, notion) {
  const { action } = req.query;
  const data = req.body;
  const { NOTION_WORKFLOWS_DATABASE_ID } = process.env;
  
  switch (action) {
    case 'delete-workflow':
      return await deleteWorkflow(res, notion, NOTION_WORKFLOWS_DATABASE_ID, data);
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

// Create new project
async function createProject(res, notion, projectsDbId, data) {
  const { 
    name, status, instrumentMake, instrumentModel, complexity, profitability, dueDate,
    neckReliefBefore, before1stString1stFret, before1stString12thFret, before6thString1stFret, before6thString12thFret,
    neckReliefAfter, after1stString1stFret, after1stString12thFret, after6thString1stFret, after6thString12thFret
  } = data;
  
  console.log('Creating new project:', { name, status, instrumentMake, instrumentModel, complexity, profitability, dueDate });
  
  try {
    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    // Build the properties object for the new project
    const properties = {
      'Name': {
        title: [{ text: { content: name.trim() } }]
      },
      'Status': {
        select: { name: status || 'On The Bench' }
      }
    };
    
    // Add optional fields if provided
    if (instrumentMake !== undefined) {
      properties['Instrument Make'] = { 
        rich_text: [{ text: { content: instrumentMake || '' } }] 
      };
    }
    
    if (instrumentModel !== undefined) {
      properties['Instrument Model'] = { 
        rich_text: [{ text: { content: instrumentModel || '' } }] 
      };
    }
    
    if (complexity !== undefined) {
      properties['Complexity'] = { number: complexity };
    }
    
    if (profitability !== undefined) {
      properties['Profitability'] = { number: profitability };
    }
    
    // Add measurement fields if provided
    if (neckReliefBefore !== undefined && neckReliefBefore !== null) {
      properties['Neck Relief Before'] = { number: neckReliefBefore };
    }
    if (before1stString1stFret !== undefined && before1stString1stFret !== null) {
      properties['Before 1st string at 1st fret'] = { number: before1stString1stFret };
    }
    if (before1stString12thFret !== undefined && before1stString12thFret !== null) {
      properties['Before 1st string at 12th fret'] = { number: before1stString12thFret };
    }
    if (before6thString1stFret !== undefined && before6thString1stFret !== null) {
      properties['Before 6th string at 1st fret'] = { number: before6thString1stFret };
    }
    if (before6thString12thFret !== undefined && before6thString12thFret !== null) {
      properties['Before 6th string at 12th fret'] = { number: before6thString12thFret };
    }
    if (neckReliefAfter !== undefined && neckReliefAfter !== null) {
      properties['Neck Relief After'] = { number: neckReliefAfter };
    }
    if (after1stString1stFret !== undefined && after1stString1stFret !== null) {
      properties['After 1st string at 1st fret'] = { number: after1stString1stFret };
    }
    if (after1stString12thFret !== undefined && after1stString12thFret !== null) {
      properties['After 1st string at 12th fret'] = { number: after1stString12thFret };
    }
    if (after6thString1stFret !== undefined && after6thString1stFret !== null) {
      properties['After 6th string at 1st fret'] = { number: after6thString1stFret };
    }
    if (after6thString12thFret !== undefined && after6thString12thFret !== null) {
      properties['After 6th string at 12th fret'] = { number: after6thString12thFret };
    }
    
    if (dueDate) {
      properties['Due Date'] = { date: { start: dueDate } };
    }
    
    // Set the current date for "Date Created" if the field exists
    const nowISO = new Date().toISOString().split('T')[0]; // Just the date part
    properties['Date Created'] = { date: { start: nowISO } };
    
    console.log('Creating project with properties:', JSON.stringify(properties, null, 2));
    
    // Create the project in Notion
    const response = await notion.pages.create({
      parent: { database_id: projectsDbId },
      properties
    });
    
    console.log('Project created successfully:', response.id);
    
    // Map the response to our project format
    const createdProject = mapProject(response);
    
    return res.json({ 
      success: true, 
      message: 'Project created successfully',
      project: createdProject
    });
    
  } catch (error) {
    console.error('Project creation error:', {
      message: error.message,
      code: error.code,
      status: error.status,
      body: error.body
    });
    
    return res.status(500).json({ 
      error: 'Failed to create project', 
      detail: error.message,
      code: error.code,
      notionError: error.body 
    });
  }
}

// Get all projects and milestones for scheduling
async function getAllData(res, notion, projectsDbId, milestonesDbId) {
  try {
    let allProjects = [];
    let hasMore = true;
    let nextCursor = undefined;
    
    while (hasMore) {
      const projectsResponse = await notion.databases.query({
        database_id: projectsDbId,
        filter: {
          property: 'Status',
          select: {
            equals: 'On The Bench'
          }
        },
        page_size: 100,
        start_cursor: nextCursor
      });
      
      allProjects = allProjects.concat(projectsResponse.results);
      hasMore = projectsResponse.has_more;
      nextCursor = projectsResponse.next_cursor;
    }
    
    let allMilestones = [];
    hasMore = true;
    nextCursor = undefined;
    
    while (hasMore) {
      const milestonesResponse = await notion.databases.query({
        database_id: milestonesDbId,
        page_size: 100,
        start_cursor: nextCursor
      });
      
      allMilestones = allMilestones.concat(milestonesResponse.results);
      hasMore = milestonesResponse.has_more;
      nextCursor = milestonesResponse.next_cursor;
    }
    
    const projects = allProjects.map(mapProject);
    const milestones = allMilestones.map(mapMilestone);
    
    console.log(`API returning ${projects.length} projects and ${milestones.length} milestones`);
    
    return res.json({ projects, milestones });
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw new Error(`Failed to fetch data: ${error.message}`);
  }
}

// Get workflow templates
async function getWorkflows(res, notion, workflowsDbId) {
  console.log('getWorkflows called with workflowsDbId:', workflowsDbId);
  
  if (!workflowsDbId) {
    console.log('No workflows database ID provided');
    return res.json({ workflows: [], error: 'No workflows database ID configured' });
  }
  
  try {
    console.log('Attempting to fetch workflows from database:', workflowsDbId);
    
    // First, try to retrieve the database info to verify access
    try {
      const dbInfo = await notion.databases.retrieve({
        database_id: workflowsDbId
      });
      console.log('Workflows database found:', dbInfo.title?.[0]?.plain_text || 'Untitled');
    } catch (dbError) {
      console.error('Cannot access workflows database:', dbError.message);
      return res.json({ 
        workflows: [], 
        error: `Cannot access workflows database: ${dbError.message}` 
      });
    }
    
    let allWorkflows = [];
    let hasMore = true;
    let nextCursor = undefined;
    
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: workflowsDbId,
        page_size: 100,
        start_cursor: nextCursor
      });
      
      console.log(`Fetched ${response.results.length} workflows (batch)`);
      allWorkflows = allWorkflows.concat(response.results);
      hasMore = response.has_more;
      nextCursor = response.next_cursor;
    }
    
    console.log(`Total workflows retrieved: ${allWorkflows.length}`);
    
    const workflows = allWorkflows.map(page => {
      const workflow = {
        id: page.id,
        name: page.properties?.Name?.title?.[0]?.plain_text ?? 'Untitled',
        data: page.properties?.Data?.rich_text?.[0]?.plain_text ?? '[]'
      };
      console.log('Mapped workflow:', workflow.name, 'data length:', workflow.data.length);
      return workflow;
    });
    
    console.log(`Returning ${workflows.length} workflows`);
    return res.json({ workflows });
  } catch (error) {
    console.error('Error fetching workflows:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    return res.json({ 
      workflows: [], 
      error: `Failed to fetch workflows: ${error.message}`,
      errorCode: error.code 
    });
  }
}

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
  const { completedMilestones } = data || {};

  // 1) Validate payload
  if (!Array.isArray(completedMilestones) || completedMilestones.length === 0) {
    return res.status(400).json({ success: false, message: 'No completed milestones provided.' });
  }

  try {
    // 2) Build milestone updates + collect affected project IDs
    const projectIds = new Set();
    const milestoneUpdates = completedMilestones.map(({ milestoneId, projectId, actualHours }) => {
      if (!milestoneId || !projectId || typeof actualHours !== 'number') {
        throw new Error('Each item must include milestoneId, projectId, and numeric actualHours.');
      }
      projectIds.add(projectId);

      return notion.pages.update({
        page_id: milestoneId,
        properties: {
          'Status': { select: { name: 'Completed' } },
          'Actual Hours': { number: actualHours }
        }
      });
    });

    // 3) Build project updates: stamp "Last Worked" for each affected project
    const nowISO = new Date().toISOString();
    const projectUpdates = Array.from(projectIds).map(projectId =>
      notion.pages.update({
        page_id: projectId,
        properties: { 'Last Worked': { date: { start: nowISO } } }
      })
    );

    // 4) Execute all updates
    await Promise.all([...milestoneUpdates, ...projectUpdates]);

    // 5) Respond with a summary (and echo lastWorked for immediate UI sync)
    return res.json({
      success: true,
      message: 'Progress saved successfully.',
      updatedMilestones: completedMilestones.map(m => m.milestoneId),
      updatedProjects: Array.from(projectIds),
      lastWorked: nowISO
    });
  } catch (error) {
    const detail = error?.body ? JSON.stringify(error.body) : error.message;
    return res.status(500).json({ success: false, message: `Failed to save progress: ${detail}` });
  }
}

// Update project information - FIXED VERSION with better debugging
async function updateProject(res, notion, projectsDbId, data) {
  const { projectId, ...updates } = data;
  
  console.log('updateProject called with:', { projectId, updates });
  
  try {
    const properties = {};
    
    if (updates.name) {
      properties.Name = { title: [{ text: { content: updates.name } }] };
      console.log('Setting Name:', updates.name);
    }
    if (updates.status) {
      properties.Status = { select: { name: updates.status } };
      console.log('Setting Status:', updates.status);
    }
    if (updates.instrumentMake !== undefined) {
      properties['Instrument Make'] = { 
        rich_text: [{ text: { content: updates.instrumentMake || '' } }] 
      };
      console.log('Setting Instrument Make:', updates.instrumentMake);
    }
    if (updates.instrumentModel !== undefined) {
      properties['Instrument Model'] = { 
        rich_text: [{ text: { content: updates.instrumentModel || '' } }] 
      };
      console.log('Setting Instrument Model:', updates.instrumentModel);
    }
    if (updates.complexity !== undefined) {
      properties['Complexity'] = { number: updates.complexity };
      console.log('Setting Complexity:', updates.complexity);
    }
    if (updates.profitability !== undefined) {
      properties['Profitability'] = { number: updates.profitability };
      console.log('Setting Profitability:', updates.profitability);
    }
    if (updates.dueDate !== undefined) {
      if (updates.dueDate === null || updates.dueDate === '') {
        properties['Due Date'] = { date: null };
        console.log('Clearing Due Date');
      } else {
        properties['Due Date'] = { date: { start: updates.dueDate } };
        console.log('Setting Due Date:', updates.dueDate);
      }
    }

    // Add measurement fields
    if (updates.neckReliefBefore !== undefined) {
      properties['Neck Relief Before'] = updates.neckReliefBefore !== null ? { number: updates.neckReliefBefore } : { number: null };
      console.log('Setting Neck Relief Before:', updates.neckReliefBefore);
    }
    if (updates.before1stString1stFret !== undefined) {
      properties['Before 1st string at 1st fret'] = updates.before1stString1stFret !== null ? { number: updates.before1stString1stFret } : { number: null };
      console.log('Setting Before 1st string at 1st fret:', updates.before1stString1stFret);
    }
    if (updates.before1stString12thFret !== undefined) {
      properties['Before 1st string at 12th fret'] = updates.before1stString12thFret !== null ? { number: updates.before1stString12thFret } : { number: null };
      console.log('Setting Before 1st string at 12th fret:', updates.before1stString12thFret);
    }
    if (updates.before6thString1stFret !== undefined) {
      properties['Before 6th string at 1st fret'] = updates.before6thString1stFret !== null ? { number: updates.before6thString1stFret } : { number: null };
      console.log('Setting Before 6th string at 1st fret:', updates.before6thString1stFret);
    }
    if (updates.before6thString12thFret !== undefined) {
      properties['Before 6th string at 12th fret'] = updates.before6thString12thFret !== null ? { number: updates.before6thString12thFret } : { number: null };
      console.log('Setting Before 6th string at 12th fret:', updates.before6thString12thFret);
    }
    if (updates.neckReliefAfter !== undefined) {
      properties['Neck Relief After'] = updates.neckReliefAfter !== null ? { number: updates.neckReliefAfter } : { number: null };
      console.log('Setting Neck Relief After:', updates.neckReliefAfter);
    }
    if (updates.after1stString1stFret !== undefined) {
      properties['After 1st string at 1st fret'] = updates.after1stString1stFret !== null ? { number: updates.after1stString1stFret } : { number: null };
      console.log('Setting After 1st string at 1st fret:', updates.after1stString1stFret);
    }
    if (updates.after1stString12thFret !== undefined) {
      properties['After 1st string at 12th fret'] = updates.after1stString12thFret !== null ? { number: updates.after1stString12thFret } : { number: null };
      console.log('Setting After 1st string at 12th fret:', updates.after1stString12thFret);
    }
    if (updates.after6thString1stFret !== undefined) {
      properties['After 6th string at 1st fret'] = updates.after6thString1stFret !== null ? { number: updates.after6thString1stFret } : { number: null };
      console.log('Setting After 6th string at 1st fret:', updates.after6thString1stFret);
    }
    if (updates.after6thString12thFret !== undefined) {
      properties['After 6th string at 12th fret'] = updates.after6thString12thFret !== null ? { number: updates.after6thString12thFret } : { number: null };
      console.log('Setting After 6th string at 12th fret:', updates.after6thString12thFret);
    }

    console.log('Final properties to update:', JSON.stringify(properties, null, 2));

    const updateResult = await notion.pages.update({
      page_id: projectId,
      properties
    });

    console.log('Project update successful, updated page:', updateResult.id);
    return res.json({ success: true, message: 'Project updated successfully' });
    
  } catch (error) {
    console.error('Project update error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      body: error.body
    });
    
    // Return the detailed error to help debug
    return res.status(500).json({ 
      error: 'Project update failed', 
      detail: error.message,
      code: error.code,
      notionError: error.body 
    });
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
    
    for (let i = 0; i < milestones.length; i++) {
      const milestone = milestones[i];
      
      if (milestone.id && existingMilestones.find(m => m.id === milestone.id)) {
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

// Create new workflow
async function createWorkflow(res, notion, workflowsDbId, data) {
  const { name, data: workflowData } = data;
  
  console.log('Creating workflow:', { name, dataLength: workflowData?.length });
  
  if (!workflowsDbId) {
    return res.status(500).json({ error: 'Workflows database not configured' });
  }
  
  try {
    // Validate the workflow data is valid JSON
    try {
      JSON.parse(workflowData || '[]');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON in workflow data' });
    }
    
    const response = await notion.pages.create({
      parent: { database_id: workflowsDbId },
      properties: {
        'Name': {
          title: [{ text: { content: name || 'Untitled Workflow' } }]
        },
        'Data': {
          rich_text: [{ text: { content: workflowData || '[]' } }]
        }
      }
    });
    
    const createdWorkflow = {
      id: response.id,
      name: name || 'Untitled Workflow',
      data: workflowData || '[]'
    };
    
    console.log('Workflow created successfully:', createdWorkflow.id);
    return res.json({ success: true, workflow: createdWorkflow });
  } catch (error) {
    console.error('Failed to create workflow:', error);
    throw new Error(`Failed to create workflow: ${error.message}`);
  }
}

// Update existing workflow
async function updateWorkflow(res, notion, workflowsDbId, data) {
  const { id, name, data: workflowData } = data;
  
  console.log('Updating workflow:', { id, name, dataLength: workflowData?.length });
  
  if (!workflowsDbId) {
    return res.status(500).json({ error: 'Workflows database not configured' });
  }
  
  if (!id) {
    return res.status(400).json({ error: 'Workflow ID is required for update' });
  }
  
  try {
    // Validate the workflow data is valid JSON
    try {
      JSON.parse(workflowData || '[]');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON in workflow data' });
    }
    
    await notion.pages.update({
      page_id: id,
      properties: {
        'Name': {
          title: [{ text: { content: name || 'Untitled Workflow' } }]
        },
        'Data': {
          rich_text: [{ text: { content: workflowData || '[]' } }]
        }
      }
    });
    
    console.log('Workflow updated successfully:', id);
    return res.json({ success: true, message: 'Workflow updated successfully' });
  } catch (error) {
    console.error('Failed to update workflow:', error);
    throw new Error(`Failed to update workflow: ${error.message}`);
  }
}

// Delete workflow
async function deleteWorkflow(res, notion, workflowsDbId, data) {
  const { id } = data;
  
  console.log('Deleting workflow:', id);
  
  if (!workflowsDbId) {
    return res.status(500).json({ error: 'Workflows database not configured' });
  }
  
  if (!id) {
    return res.status(400).json({ error: 'Workflow ID is required for deletion' });
  }
  
  try {
    await notion.pages.update({
      page_id: id,
      archived: true
    });
    
    console.log('Workflow deleted successfully:', id);
    return res.json({ success: true, message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('Failed to delete workflow:', error);
    throw new Error(`Failed to delete workflow: ${error.message}`);
  }
}

function parseIntSafe(v) {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

// Mapping functions
function mapProject(page) {
  const props = page.properties;  // <-- use ONE name consistently

  return {
    id: page.id,
    name: props['Name']?.title?.[0]?.plain_text ?? 'Untitled',
    instrumentMake: props['Instrument Make']?.rich_text?.[0]?.plain_text ?? '',
    instrumentModel: props['Instrument Model']?.rich_text?.[0]?.plain_text ?? '',
    status: props['Status']?.select?.name ?? 'Unknown',
    dueDate: props['Due Date']?.date?.start ?? null,

    // numeric fields (now just simple number properties)
    complexity: props['Complexity']?.number ?? 3,
    profitability: props['Profitability']?.number ?? 3,

    // dates for "days since worked"
    lastWorked: props['Last Worked']?.date?.start ?? null,
   
    dateCreated: props['Date Created']?.date?.start ?? null,   // your custom date
    createdTime: page.created_time,                            // Notion system created timestamp

    // measurement fields
    neckReliefBefore: props['Neck Relief Before']?.number ?? null,
    before1stString1stFret: props['Before 1st string at 1st fret']?.number ?? null,
    before1stString12thFret: props['Before 1st string at 12th fret']?.number ?? null,
    before6thString1stFret: props['Before 6th string at 1st fret']?.number ?? null,
    before6thString12thFret: props['Before 6th string at 12th fret']?.number ?? null,
    neckReliefAfter: props['Neck Relief After']?.number ?? null,
    after1stString1stFret: props['After 1st string at 1st fret']?.number ?? null,
    after1stString12thFret: props['After 1st string at 12th fret']?.number ?? null,
    after6thString1stFret: props['After 6th string at 1st fret']?.number ?? null,
    after6thString12thFret: props['After 6th string at 12th fret']?.number ?? null,

    // rollups / formulas you already use
    totalEstimatedHour: props['Total Estimated Hour']?.rollup?.number ?? 0,
    totalMilestones: props['Total Milestones']?.rollup?.number ?? 0,
    completedMilestones: props['Completed Milestones']?.rollup?.number ?? 0,
    progress: props['Progress %']?.formula?.number ?? 0
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
