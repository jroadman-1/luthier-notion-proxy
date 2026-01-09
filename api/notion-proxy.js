// /api/notion-proxy.js - Complete system API with billing fields including Discount
const { Client } = require('@notionhq/client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { NOTION_TOKEN, NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID, NOTION_PARTS_DATABASE_ID, NOTION_WORKFLOWS_DATABASE_ID, NOTION_INBOX_DATABASE_ID } = process.env;
    
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
  const { NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID, NOTION_PARTS_DATABASE_ID, NOTION_WORKFLOWS_DATABASE_ID, NOTION_INBOX_DATABASE_ID } = process.env;
  
  switch (action) {
    case 'workflows':
      return await getWorkflows(res, notion, NOTION_WORKFLOWS_DATABASE_ID);
    case 'todos':
      return await getTodos(res, notion, NOTION_INBOX_DATABASE_ID);
    case 'debug-project-schema':
      return await debugProjectSchema(res, notion, NOTION_DATABASE_ID);
    default:
      return await getAllData(req, res, notion, NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID, NOTION_PARTS_DATABASE_ID);
  }
}

async function handlePost(req, res, notion) {
  const { action } = req.query;
  const data = req.body;
  const { NOTION_MILESTONES_DATABASE_ID, NOTION_DATABASE_ID, NOTION_PARTS_DATABASE_ID, NOTION_WORKFLOWS_DATABASE_ID, NOTION_INBOX_DATABASE_ID } = process.env;
  
  switch (action) {
    case 'create-project':
      return await createProject(res, notion, NOTION_DATABASE_ID, data);
    case 'create-milestones':
      return await createMilestones(res, notion, NOTION_MILESTONES_DATABASE_ID, data);
    case 'save-progress':
      return await saveProgress(res, notion, NOTION_MILESTONES_DATABASE_ID, NOTION_DATABASE_ID, data);
    case 'save-milestones':
      return await saveMilestones(res, notion, NOTION_MILESTONES_DATABASE_ID, data);
    case 'save-parts':
      return await saveParts(res, notion, NOTION_PARTS_DATABASE_ID, data);
    case 'create-workflow':
      return await createWorkflow(res, notion, NOTION_WORKFLOWS_DATABASE_ID, data);
    case 'create-todo':
      return await createTodo(res, notion, NOTION_INBOX_DATABASE_ID, data);
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handlePut(req, res, notion) {
  const { action } = req.query;
  const data = req.body;
  const { NOTION_MILESTONES_DATABASE_ID, NOTION_DATABASE_ID, NOTION_WORKFLOWS_DATABASE_ID, NOTION_INBOX_DATABASE_ID } = process.env;
  
  switch (action) {
    case 'update-milestone':
      return await updateMilestone(res, notion, NOTION_MILESTONES_DATABASE_ID, data);
    case 'update-project':
      return await updateProject(res, notion, NOTION_DATABASE_ID, data);
    case 'update-workflow':
      return await updateWorkflow(res, notion, NOTION_WORKFLOWS_DATABASE_ID, data);
    case 'update-todo':
      return await updateTodo(res, notion, NOTION_INBOX_DATABASE_ID, data);
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

// Get all projects and milestones for scheduling
async function getAllData(req, res, notion, projectsDbId, milestonesDbId, partsDbId) {
  try {
    console.log('getAllData called - fetching projects with active statuses');
    
    let allProjects = [];
    let hasMore = true;
    let nextCursor = undefined;
    
    while (hasMore) {
      const queryOptions = {
        database_id: projectsDbId,
        filter: {
          or: [
            {
              property: 'Status',
              select: {
                equals: 'On The Bench'
              }
            },
            {
              property: 'Status',
              select: {
                equals: 'Waiting'
              }
            },
            {
              property: 'Status',
              select: {
                equals: 'Done'
              }
              },
            {
              property: 'Status',
              select: {
                equals: 'Returned'
              }
            }
          ]
        },
        page_size: 100,
        start_cursor: nextCursor
      };
      
      const projectsResponse = await notion.databases.query(queryOptions);
      
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
    
    let allParts = [];
    if (partsDbId) {
      try {
        hasMore = true;
        nextCursor = undefined;
        
        while (hasMore) {
          const partsResponse = await notion.databases.query({
            database_id: partsDbId,
            page_size: 100,
            start_cursor: nextCursor
          });
          
          allParts = allParts.concat(partsResponse.results);
          hasMore = partsResponse.has_more;
          nextCursor = partsResponse.next_cursor;
        }
      } catch (partsError) {
        console.warn('Parts database not accessible:', partsError.message);
        // Continue without parts - it's optional
      }
    }
    
    const projects = allProjects.map(mapProject);
    const milestones = allMilestones.map(mapMilestone);
    const parts = allParts.map(mapPart);
    
    console.log(`API returning ${projects.length} projects (On The Bench, Waiting, Done, Returned), ${milestones.length} milestones, and ${parts.length} parts`);
    
    return res.json({ projects, milestones, parts });
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch data', 
      detail: error.message 
    });
  }
}

// Create new project
async function createProject(res, notion, projectsDbId, data) {
  const { 
    name, projectId, status, instrumentMake, instrumentModel, complexity, profitability, 
    dueDate, store, project_type, intakeNotes, estimateNotes,
    // Measurement fields
    neckReliefBefore, before1stString1stFret, before1stString12thFret, 
    before6thString1stFret, before6thString12thFret,
    neckReliefAfter, after1stString1stFret, after1stString12thFret, 
    after6thString1stFret, after6thString12thFret,
    // Instrument details
    instrumentFinish, serialNumber, instrumentType, stringBrand, stringGauge,
    tuning, tremolo, fretboardRadius, fretwire,
    // Actions
    actions, additionalActions,
    // Billing fields
    total, subtotal, commission, discount, taxAmount, tip, hourlyRate, notes
  } = data;
  
  console.log('Creating new project:', { name, projectId, status, instrumentMake, instrumentModel });
  
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
    
    // Add Project ID field (corrected to number type)
    if (projectId !== undefined && projectId !== '') {
      const idNumber = parseInt(projectId, 10);
      if (!isNaN(idNumber)) {
        properties['ID'] = { number: idNumber };
      }
    }
    
    // Add basic project fields
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

    if (store !== undefined && store !== '') {
      properties['Store'] = { 
        select: { name: store }
      };
    }

    if (project_type !== undefined && project_type !== '') {
      properties['project_type'] = { 
        select: { name: project_type }
      };
    }

    if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
      properties['Due Date'] = { 
        date: { start: dueDate }
      };
    }

    if (intakeNotes !== undefined) {
      properties['Intake Notes'] = { 
        rich_text: [{ text: { content: intakeNotes || '' } }] 
      };
    }
    
    if (estimateNotes !== undefined) {
      properties['Estimate Notes'] = { 
        rich_text: [{ text: { content: estimateNotes || '' } }] 
      };
    }
    
    // Add billing fields
    if (total !== undefined && total !== null && total !== '') {
      properties['Total'] = { number: parseFloat(total) };
    }
    
    if (subtotal !== undefined && subtotal !== null && subtotal !== '') {
      properties['Subtotal'] = { number: parseFloat(subtotal) };
    }
    
    if (commission !== undefined && commission !== null && commission !== '') {
      properties['Commission'] = { number: parseFloat(commission) };
    }
    
    // Add discount field (percentage as integer)
    if (discount !== undefined && discount !== null && discount !== '') {
      properties['Discount'] = { number: parseInt(discount) };
    }
    
    // Add taxAmount field
    if (taxAmount !== undefined && taxAmount !== null && taxAmount !== '') {
      properties['taxAmount'] = { number: parseFloat(taxAmount) };
    }
    
    // Add tip field
    if (tip !== undefined && tip !== null && tip !== '') {
      properties['Tip'] = { number: parseFloat(tip) };
    }
    
    // Add hourlyRate field (captures rate at project creation time)
    if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== '') {
      properties['Hourly Rate'] = { number: parseFloat(hourlyRate) };
    }

    // Add measurement fields
    if (neckReliefBefore !== undefined && neckReliefBefore !== null && neckReliefBefore !== '') {
      properties['Neck Relief Before'] = { 
        rich_text: [{ text: { content: String(neckReliefBefore) } }] 
      };
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
    if (neckReliefAfter !== undefined && neckReliefAfter !== null && neckReliefAfter !== '') {
      properties['Neck Relief After'] = { 
        rich_text: [{ text: { content: String(neckReliefAfter) } }] 
      };
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

    // Add instrument detail fields
    if (instrumentFinish !== undefined) {
      properties['Instrument Finish'] = { 
        rich_text: [{ text: { content: instrumentFinish || '' } }] 
      };
    }
    if (serialNumber !== undefined) {
      properties['Serial Number'] = { 
        rich_text: [{ text: { content: serialNumber || '' } }] 
      };
    }
    if (instrumentType !== undefined && instrumentType !== '') {
      properties['Instrument Type'] = { 
        select: { name: instrumentType }
      };
    }
    if (stringBrand !== undefined) {
      properties['String Brand'] = { 
        rich_text: [{ text: { content: stringBrand || '' } }] 
      };
    }
    if (stringGauge !== undefined) {
      properties['String Gauge'] = { 
        rich_text: [{ text: { content: stringGauge || '' } }] 
      };
    }
    if (tuning !== undefined && tuning !== '') {
      properties['Tuning'] = { 
        select: { name: tuning }
      };
    }
    if (tremolo !== undefined) {
      properties['Tremolo'] = { 
        rich_text: [{ text: { content: tremolo || '' } }] 
      };
    }
    if (fretboardRadius !== undefined && fretboardRadius !== null) {
      properties['Fretboard Radius'] = { number: fretboardRadius };
    }
    if (fretwire !== undefined) {
      properties['Fretwire'] = { 
        rich_text: [{ text: { content: fretwire || '' } }] 
      };
    }

    // Add actions (corrected field name to "Standard Actions")
    if (actions && typeof actions === 'object') {
      const actionMap = {
        adjustedHeightRadius: 'Adjusted Height and Radius',
        adjustedIntonation: 'Adjusted Intonation',
        adjustedPickupHeight: 'Adjusted Pickup Height',
        adjustedTrussRod: 'Adjusted Truss Rod',
        adjustedStringSlots: 'Adjusted String Slots',
        cleanedPolished: 'Cleaned and Polished',
        installedStretchedStrings: 'Installed and Stretched Strings',
        lubricatedStringSlots: 'Lubricated String Slots',
        oiledFretboard: 'Oiled Fretboard',
        polishedFrets: 'Polished Frets',
        testedElectronics: 'Tested Electronics',
        tightenedHardware: 'Tightened Hardware',
        adjustedTremoloTension: 'Adjusted Tremolo Tension',
        adjustedNeckAngle: 'Adjusted Neck Angle'
      };

      const selectedActions = [];
      for (const [key, value] of Object.entries(actions)) {
        if (value && actionMap[key]) {
          selectedActions.push({ name: actionMap[key] });
        }
      }

      if (selectedActions.length > 0) {
        properties['Standard Actions'] = { multi_select: selectedActions };
      }
    }

    if (additionalActions !== undefined) {
      properties['Additional Actions'] = { 
        rich_text: [{ text: { content: additionalActions || '' } }] 
      };
    }

    if (notes !== undefined) {
      properties['Notes'] = { 
        rich_text: [{ text: { content: notes || '' } }] 
      };
    }
    
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

// Update project information - ENHANCED VERSION with billing fields including Discount
async function updateProject(res, notion, projectsDbId, data) {
  const { id, ...updates } = data;
  
  console.log('updateProject called with:', { id, updates });
  
  if (!id) {
    return res.status(400).json({ error: 'Project ID (Notion page ID) is required for update' });
  }
  
  try {
    const properties = {};
    
    // Basic fields
    if (updates.name) {
      properties.Name = { title: [{ text: { content: updates.name } }] };
      console.log('Setting Name:', updates.name);
    }
    if (updates.projectId !== undefined) {
      if (updates.projectId === null || updates.projectId === '') {
        properties['ID'] = { number: null };
      } else {
        const idNumber = parseInt(updates.projectId, 10);
        if (!isNaN(idNumber)) {
          properties['ID'] = { number: idNumber };
        }
      }
      console.log('Setting Project ID:', updates.projectId);
    }
    if (updates.status) {
      properties.Status = { select: { name: updates.status } };
      console.log('Setting Status:', updates.status);
      
      // Automatically set paidDate when status changes to "Paid"
      if (updates.status === 'Paid' && !updates.paidDate) {
        properties['paidDate'] = { date: { start: new Date().toISOString().split('T')[0] } };
        console.log('Automatically setting paidDate to today');
      }
    }
    
    // Allow manual override of paidDate if provided
    if (updates.paidDate !== undefined) {
      if (updates.paidDate === null || updates.paidDate === '') {
        properties['paidDate'] = { date: null };
        console.log('Clearing paidDate');
      } else {
        properties['paidDate'] = { date: { start: updates.paidDate } };
        console.log('Setting paidDate:', updates.paidDate);
      }
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
    if (updates.store !== undefined) {
      if (updates.store === null || updates.store === '') {
        properties['Store'] = { select: null };
        console.log('Clearing Store');
      } else {
        properties['Store'] = { select: { name: updates.store } };
        console.log('Setting Store:', updates.store);
      }
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
    if (updates.intakeNotes !== undefined) {
      properties['Intake Notes'] = { 
        rich_text: [{ text: { content: updates.intakeNotes || '' } }] 
      };
      console.log('Setting Intake Notes:', updates.intakeNotes);
    }
    if (updates.estimateNotes !== undefined) {
      properties['Estimate Notes'] = { 
        rich_text: [{ text: { content: updates.estimateNotes || '' } }] 
      };
      console.log('Setting Estimate Notes:', updates.estimateNotes);
    }

    // Billing fields
    if (updates.total !== undefined) {
      if (updates.total === null || updates.total === '') {
        properties['Total'] = { number: null };
        console.log('Clearing Total');
      } else {
        properties['Total'] = { number: parseFloat(updates.total) };
        console.log('Setting Total:', updates.total);
      }
    }
    
    if (updates.subtotal !== undefined) {
      if (updates.subtotal === null || updates.subtotal === '') {
        properties['Subtotal'] = { number: null };
        console.log('Clearing Subtotal');
      } else {
        properties['Subtotal'] = { number: parseFloat(updates.subtotal) };
        console.log('Setting Subtotal:', updates.subtotal);
      }
    }
    
    if (updates.commission !== undefined) {
      if (updates.commission === null || updates.commission === '') {
        properties['Commission'] = { number: null };
        console.log('Clearing Commission');
      } else {
        properties['Commission'] = { number: parseFloat(updates.commission) };
        console.log('Setting Commission:', updates.commission);
      }
    }
    
    // Add discount field handling (percentage as integer)
    if (updates.discount !== undefined) {
      if (updates.discount === null || updates.discount === '') {
        properties['Discount'] = { number: null };
        console.log('Clearing Discount');
      } else {
        properties['Discount'] = { number: parseInt(updates.discount) };
        console.log('Setting Discount:', updates.discount);
      }
    }
    
    // Add taxAmount field handling
    if (updates.taxAmount !== undefined) {
      if (updates.taxAmount === null || updates.taxAmount === '') {
        properties['taxAmount'] = { number: null };
        console.log('Clearing taxAmount');
      } else {
        properties['taxAmount'] = { number: parseFloat(updates.taxAmount) };
        console.log('Setting taxAmount:', updates.taxAmount);
      }
    }
    
    // Add tip field handling
    if (updates.tip !== undefined) {
      if (updates.tip === null || updates.tip === '') {
        properties['Tip'] = { number: null };
        console.log('Clearing Tip');
      } else {
        properties['Tip'] = { number: parseFloat(updates.tip) };
        console.log('Setting Tip:', updates.tip);
      }
    }
    
    // Add hourlyRate field handling (captures rate at project creation time)
    if (updates.hourlyRate !== undefined) {
      if (updates.hourlyRate === null || updates.hourlyRate === '') {
        properties['Hourly Rate'] = { number: null };
        console.log('Clearing Hourly Rate');
      } else {
        properties['Hourly Rate'] = { number: parseFloat(updates.hourlyRate) };
        console.log('Setting Hourly Rate:', updates.hourlyRate);
      }
    }

    // Measurement fields
    if (updates.neckReliefBefore !== undefined) {
      if (updates.neckReliefBefore === null || updates.neckReliefBefore === '') {
        properties['Neck Relief Before'] = { rich_text: [] };
      } else {
        properties['Neck Relief Before'] = { 
          rich_text: [{ text: { content: String(updates.neckReliefBefore) } }] 
        };
      }
    }
    if (updates.before1stString1stFret !== undefined) {
      properties['Before 1st string at 1st fret'] = updates.before1stString1stFret !== null ? { number: updates.before1stString1stFret } : { number: null };
    }
    if (updates.before1stString12thFret !== undefined) {
      properties['Before 1st string at 12th fret'] = updates.before1stString12thFret !== null ? { number: updates.before1stString12thFret } : { number: null };
    }
    if (updates.before6thString1stFret !== undefined) {
      properties['Before 6th string at 1st fret'] = updates.before6thString1stFret !== null ? { number: updates.before6thString1stFret } : { number: null };
    }
    if (updates.before6thString12thFret !== undefined) {
      properties['Before 6th string at 12th fret'] = updates.before6thString12thFret !== null ? { number: updates.before6thString12thFret } : { number: null };
    }
    if (updates.neckReliefAfter !== undefined) {
      if (updates.neckReliefAfter === null || updates.neckReliefAfter === '') {
        properties['Neck Relief After'] = { rich_text: [] };
      } else {
        properties['Neck Relief After'] = { 
          rich_text: [{ text: { content: String(updates.neckReliefAfter) } }] 
        };
      }
    }
    if (updates.after1stString1stFret !== undefined) {
      properties['After 1st string at 1st fret'] = updates.after1stString1stFret !== null ? { number: updates.after1stString1stFret } : { number: null };
    }
    if (updates.after1stString12thFret !== undefined) {
      properties['After 1st string at 12th fret'] = updates.after1stString12thFret !== null ? { number: updates.after1stString12thFret } : { number: null };
    }
    if (updates.after6thString1stFret !== undefined) {
      properties['After 6th string at 1st fret'] = updates.after6thString1stFret !== null ? { number: updates.after6thString1stFret } : { number: null };
    }
    if (updates.after6thString12thFret !== undefined) {
      properties['After 6th string at 12th fret'] = updates.after6thString12thFret !== null ? { number: updates.after6thString12thFret } : { number: null };
    }

    // Instrument detail fields
    if (updates.instrumentFinish !== undefined) {
      properties['Instrument Finish'] = { 
        rich_text: [{ text: { content: updates.instrumentFinish || '' } }] 
      };
    }
    if (updates.serialNumber !== undefined) {
      properties['Serial Number'] = { 
        rich_text: [{ text: { content: updates.serialNumber || '' } }] 
      };
    }
    if (updates.instrumentType !== undefined) {
      if (updates.instrumentType === null || updates.instrumentType === '') {
        properties['Instrument Type'] = { select: null };
      } else {
        properties['Instrument Type'] = { select: { name: updates.instrumentType } };
      }
    }
    if (updates.stringBrand !== undefined) {
      properties['String Brand'] = { 
        rich_text: [{ text: { content: updates.stringBrand || '' } }] 
      };
    }
    if (updates.stringGauge !== undefined) {
      properties['String Gauge'] = { 
        rich_text: [{ text: { content: updates.stringGauge || '' } }] 
      };
    }
    if (updates.tuning !== undefined) {
      if (updates.tuning === null || updates.tuning === '') {
        properties['Tuning'] = { select: null };
      } else {
        properties['Tuning'] = { select: { name: updates.tuning } };
      }
    }
    if (updates.tremolo !== undefined) {
      properties['Tremolo'] = { 
        rich_text: [{ text: { content: updates.tremolo || '' } }] 
      };
    }
    if (updates.fretboardRadius !== undefined) {
      properties['Fretboard Radius'] = updates.fretboardRadius !== null ? { number: updates.fretboardRadius } : { number: null };
    }
    if (updates.fretwire !== undefined) {
      properties['Fretwire'] = { 
        rich_text: [{ text: { content: updates.fretwire || '' } }] 
      };
    }

    // Actions (corrected field name to "Standard Actions")
    if (updates.actions && typeof updates.actions === 'object') {
      const actionMap = {
        adjustedHeightRadius: 'Adjusted Height and Radius',
        adjustedIntonation: 'Adjusted Intonation',
        adjustedPickupHeight: 'Adjusted Pickup Height',
        adjustedTrussRod: 'Adjusted Truss Rod',
        adjustedStringSlots: 'Adjusted String Slots',
        cleanedPolished: 'Cleaned and Polished',
        installedStretchedStrings: 'Installed and Stretched Strings',
        lubricatedStringSlots: 'Lubricated String Slots',
        oiledFretboard: 'Oiled Fretboard',
        polishedFrets: 'Polished Frets',
        testedElectronics: 'Tested Electronics',
        tightenedHardware: 'Tightened Hardware',
        adjustedTremoloTension: 'Adjusted Tremolo Tension',
        adjustedNeckAngle: 'Adjusted Neck Angle'
      };

      const selectedActions = [];
      for (const [key, value] of Object.entries(updates.actions)) {
        if (value && actionMap[key]) {
          selectedActions.push({ name: actionMap[key] });
        }
      }

      properties['Standard Actions'] = { multi_select: selectedActions };
      console.log('Setting Standard Actions:', selectedActions.map(a => a.name).join(', '));
    }

    if (updates.additionalActions !== undefined) {
      properties['Additional Actions'] = { 
        rich_text: [{ text: { content: updates.additionalActions || '' } }] 
      };
      console.log('Setting Additional Actions:', updates.additionalActions);
    }

    if (updates.notes !== undefined) {
      properties['Notes'] = { 
        rich_text: [{ text: { content: updates.notes || '' } }] 
      };
      console.log('Setting Notes:', updates.notes);
    }
    
    // Priority manager fields
    if (updates.project_type !== undefined) {
      if (updates.project_type === null || updates.project_type === '') {
        properties['project_type'] = { select: null };
        console.log('Clearing project_type');
      } else {
        properties['project_type'] = { select: { name: updates.project_type } };
        console.log('Setting project_type:', updates.project_type);
      }
    }
    
    if (updates.quick_job_order !== undefined) {
      properties['quick_job_order'] = updates.quick_job_order !== null ? { number: updates.quick_job_order } : { number: null };
      console.log('Setting quick_job_order:', updates.quick_job_order);
    }
    
    if (updates.multi_session_order !== undefined) {
      properties['multi_session_order'] = updates.multi_session_order !== null ? { number: updates.multi_session_order } : { number: null };
      console.log('Setting multi_session_order:', updates.multi_session_order);
    }
    
    console.log('Updating project with properties:', Object.keys(properties));
    
    await notion.pages.update({
      page_id: id,
      properties
    });
    
    console.log('Project updated successfully');
    
    return res.json({ 
      success: true, 
      message: 'Project updated successfully' 
    });
  } catch (error) {
    console.error('Failed to update project:', error);
    throw new Error(`Failed to update project: ${error.message}`);
  }
}

// Debug schema function
async function debugProjectSchema(res, notion, projectsDbId) {
  try {
    const database = await notion.databases.retrieve({ database_id: projectsDbId });
    
    const propertiesInfo = {};
    for (const [name, prop] of Object.entries(database.properties)) {
      propertiesInfo[name] = prop.type;
    }
    
    return res.json({
      title: database.title?.[0]?.plain_text,
      properties: propertiesInfo
    });
  } catch (error) {
    console.error('Failed to debug schema:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve database schema', 
      detail: error.message 
    });
  }
}

function mapProject(page) {
  const props = page.properties;

  // Helper function to extract actions from multi-select (field name corrected)
  const extractActions = (multiSelectProp) => {
    if (!multiSelectProp?.multi_select) return {};
    
    const actions = {};
    const actionMap = {
      'Adjusted Height and Radius': 'adjustedHeightRadius',
      'Adjusted Intonation': 'adjustedIntonation',
      'Adjusted Pickup Height': 'adjustedPickupHeight',
      'Adjusted Truss Rod': 'adjustedTrussRod',
      'Adjusted String Slots': 'adjustedStringSlots',
      'Cleaned and Polished': 'cleanedPolished',
      'Installed and Stretched Strings': 'installedStretchedStrings',
      'Lubricated String Slots': 'lubricatedStringSlots',
      'Oiled Fretboard': 'oiledFretboard',
      'Polished Frets': 'polishedFrets',
      'Tested Electronics': 'testedElectronics',
      'Tightened Hardware': 'tightenedHardware',
      'Adjusted Tremolo Tension': 'adjustedTremoloTension',
      'Adjusted Neck Angle': 'adjustedNeckAngle'
    };

    multiSelectProp.multi_select.forEach(item => {
      const key = actionMap[item.name];
      if (key) actions[key] = true;
    });

    return actions;
  };

  return {
    id: page.id,
    name: props['Name']?.title?.[0]?.plain_text ?? 'Untitled',
    projectId: props['ID']?.number ? String(props['ID'].number) : '',
    instrumentMake: props['Instrument Make']?.rich_text?.[0]?.plain_text ?? '',
    instrumentModel: props['Instrument Model']?.rich_text?.[0]?.plain_text ?? '',
    status: props['Status']?.select?.name ?? 'Unknown',
    dueDate: props['Due Date']?.date?.start ?? null,
    store: props['Store']?.select?.name ?? '',
    intakeNotes: props['Intake Notes']?.rich_text?.[0]?.plain_text ?? '',
    estimateNotes: props['Estimate Notes']?.rich_text?.[0]?.plain_text ?? '',

    // Numeric fields
    complexity: props['Complexity']?.number ?? 3,
    profitability: props['Profitability']?.number ?? 3,

    // Billing fields (including Discount)
    total: props['Total']?.number ?? null,
    subtotal: props['Subtotal']?.number ?? null,
    commission: props['Commission']?.number ?? null,
    discount: props['Discount']?.number ?? null,
    taxAmount: props['taxAmount']?.number ?? null,
    tip: props['Tip']?.number ?? null,
    hourlyRate: props['Hourly Rate']?.number ?? null,
    minusCommission: props['Minus Commission']?.formula?.number ?? null,

    // Dates for "days since worked"
    lastWorked: props['Last Worked']?.date?.start ?? null,
    dateCreated: props['Date Created']?.date?.start ?? null,
    createdTime: page.created_time,
    paidDate: props['paidDate']?.date?.start ?? null,

    // Priority manager fields
    project_type: props['project_type']?.select?.name ?? null,
    quick_job_order: props['quick_job_order']?.number ?? null,
    multi_session_order: props['multi_session_order']?.number ?? null,

    // Measurement fields
    neckReliefBefore: props['Neck Relief Before']?.rich_text?.[0]?.plain_text ?? null,
    before1stString1stFret: props['Before 1st string at 1st fret']?.number ?? null,
    before1stString12thFret: props['Before 1st string at 12th fret']?.number ?? null,
    before6thString1stFret: props['Before 6th string at 1st fret']?.number ?? null,
    before6thString12thFret: props['Before 6th string at 12th fret']?.number ?? null,
    neckReliefAfter: props['Neck Relief After']?.rich_text?.[0]?.plain_text ?? null,
    after1stString1stFret: props['After 1st string at 1st fret']?.number ?? null,
    after1stString12thFret: props['After 1st string at 12th fret']?.number ?? null,
    after6thString1stFret: props['After 6th string at 1st fret']?.number ?? null,
    after6thString12thFret: props['After 6th string at 12th fret']?.number ?? null,

    // Instrument detail fields (updated field types)
    instrumentFinish: props['Instrument Finish']?.rich_text?.[0]?.plain_text ?? '',
    serialNumber: props['Serial Number']?.rich_text?.[0]?.plain_text ?? '',
    instrumentType: props['Instrument Type']?.select?.name ?? '',
    stringBrand: props['String Brand']?.rich_text?.[0]?.plain_text ?? '',
    stringGauge: props['String Gauge']?.rich_text?.[0]?.plain_text ?? '',
    tuning: props['Tuning']?.select?.name ?? '',
    tremolo: props['Tremolo']?.rich_text?.[0]?.plain_text ?? '',
    fretboardRadius: props['Fretboard Radius']?.number ?? null,
    fretwire: props['Fretwire']?.rich_text?.[0]?.plain_text ?? '',

    // Actions (field name corrected to "Standard Actions")
    actions: extractActions(props['Standard Actions']),
    additionalActions: props['Additional Actions']?.rich_text?.[0]?.plain_text ?? '',
    notes: props['Notes']?.rich_text?.[0]?.plain_text ?? '',

    // Rollups/formulas (existing functionality)
    totalEstimatedHour: props['Total Estimated Hour']?.rollup?.number ?? 0,
    totalMilestones: props['Total Milestones']?.rollup?.number ?? 0,
    completedMilestones: props['Completed Milestones']?.rollup?.number ?? 0,
    progress: props['Progress %']?.formula?.number ?? 0
  };
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
      
      allWorkflows = allWorkflows.concat(response.results);
      hasMore = response.has_more;
      nextCursor = response.next_cursor;
    }
    
    console.log(`Found ${allWorkflows.length} workflows`);
    
    const workflows = allWorkflows
      .filter(page => !page.archived)
      .map(page => {
        const props = page.properties;
        return {
          id: page.id,
          name: props.Name?.title?.[0]?.plain_text ?? 'Untitled',
          data: props.Data?.rich_text?.[0]?.plain_text ?? '[]'
        };
      });
    
    console.log(`Returning ${workflows.length} active workflows`);
    return res.json({ workflows });
  } catch (error) {
    console.error('Failed to fetch workflows:', error);
    return res.json({ 
      workflows: [], 
      error: `Failed to fetch workflows: ${error.message}` 
    });
  }
}

// Create milestones for a project
async function createMilestones(res, notion, milestonesDbId, data) {
  const { projectId, milestones } = data;
  
  try {
    const promises = milestones.map((milestone, index) => {
      return notion.pages.create({
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
            number: index + 1
          },
          'Status': {
            select: { name: milestone.status || 'Not Started' }
          },
          'Milestone Type': {
            select: { name: milestone.milestoneType || 'Individual' }
          },
          'includeInEstimate': {
            checkbox: milestone.includeInEstimate !== false
          },
          'urgent': {
            checkbox: milestone.urgent || false
          }
        }
      });
    });
    
    const results = await Promise.all(promises);
    
    return res.json({ 
      success: true, 
      message: `Created ${results.length} milestones`,
      milestones: results.map(mapMilestone)
    });
  } catch (error) {
    throw new Error(`Failed to create milestones: ${error.message}`);
  }
}

// Save project progress
async function saveProgress(res, notion, milestonesDbId, projectsDbId, data) {
  const { projectId, updates } = data;
  
  try {
    const updatePromises = updates.map(({ milestoneId, actualHours, status }) => {
      return notion.pages.update({
        page_id: milestoneId,
        properties: {
          'Actual Hours': { number: actualHours },
          'Status': { select: { name: status } }
        }
      });
    });
    
    await Promise.all(updatePromises);
    
    return res.json({ success: true, message: 'Progress saved successfully' });
  } catch (error) {
    throw new Error(`Failed to save progress: ${error.message}`);
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
    if (updates.fixedPrice !== undefined) {
      properties['fixedPrice'] = { number: updates.fixedPrice ? parseFloat(updates.fixedPrice) : null };
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
    if (updates.includeInEstimate !== undefined) {
      properties.includeInEstimate = { checkbox: updates.includeInEstimate };
    }
    if (updates.urgent !== undefined) {
      properties.urgent = { checkbox: updates.urgent };
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
  
  console.log(`saveMilestones called for project ${projectId} with ${milestones.length} milestones`);
  
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
    console.log(`Found ${existingMilestones.length} existing milestones in Notion`);
    
    const updates = [];
    
    for (let i = 0; i < milestones.length; i++) {
      const milestone = milestones[i];
      
      if (milestone.id && existingMilestones.find(m => m.id === milestone.id)) {
        console.log(`Updating milestone ${i + 1}: ${milestone.name} (${milestone.id})`);
        const updatePromise = notion.pages.update({
          page_id: milestone.id,
          properties: {
            'Name': { title: [{ text: { content: milestone.name } }] },
            'Estimated Hours': { number: milestone.estimatedHours },
            'fixedPrice': { number: milestone.fixedPrice ? parseFloat(milestone.fixedPrice) : null },
            'Order (Sequence)': { number: i + 1 },
            'Status': { select: { name: milestone.status || 'Not Started' } },
            'includeInEstimate': { checkbox: milestone.includeInEstimate !== false },
            'urgent': { checkbox: milestone.urgent || false },
            'workflowGroupId': { 
              rich_text: [{ text: { content: milestone.workflowGroupId || '' } }] 
            },
            'workflowName': { 
              rich_text: [{ text: { content: milestone.workflowName || '' } }] 
            }
          }
        });
        updates.push(updatePromise);
      } else {
        console.log(`Creating new milestone ${i + 1}: ${milestone.name}`);
        const createPromise = notion.pages.create({
          parent: { database_id: milestonesDbId },
          properties: {
            'Name': { title: [{ text: { content: milestone.name } }] },
            'Work Order': { relation: [{ id: projectId }] },
            'Estimated Hours': { number: milestone.estimatedHours },
            'fixedPrice': { number: milestone.fixedPrice ? parseFloat(milestone.fixedPrice) : null },
            'Order (Sequence)': { number: i + 1 },
            'Status': { select: { name: milestone.status || 'Not Started' } },
            'Milestone Type': { select: { name: 'Individual' } },
            'includeInEstimate': { checkbox: milestone.includeInEstimate !== false },
            'urgent': { checkbox: milestone.urgent || false },
            'workflowGroupId': { 
              rich_text: [{ text: { content: milestone.workflowGroupId || '' } }] 
            },
            'workflowName': { 
              rich_text: [{ text: { content: milestone.workflowName || '' } }] 
            }
          }
        });
        updates.push(createPromise);
      }
    }
    
    // Find milestones to delete (in Notion but not in submitted array)
    const milestoneIds = milestones.filter(m => m.id).map(m => m.id);
    const toDelete = existingMilestones.filter(m => !milestoneIds.includes(m.id));
    
    console.log(`Deleting ${toDelete.length} milestones not in submitted array`);
    for (const milestone of toDelete) {
      console.log(`Archiving milestone: ${milestone.name} (${milestone.id})`);
      const deletePromise = notion.pages.update({
        page_id: milestone.id,
        archived: true
      });
      updates.push(deletePromise);
    }
    
    console.log(`Executing ${updates.length} total database operations`);
    await Promise.all(updates);
    
    console.log('All milestone operations completed successfully');
    return res.json({ 
      success: true, 
      message: `Updated ${milestones.length} milestones, deleted ${toDelete.length} milestones`
    });
  } catch (error) {
    console.error('Failed to save milestones:', error);
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

function mapMilestone(page) {
  const props = page.properties;
  
  return {
    id: page.id,
    projectId: props['Work Order']?.relation?.[0]?.id || null,
    name: props.Name?.title?.[0]?.plain_text ?? 'Untitled',
    estimatedHours: props['Estimated Hours']?.number ?? 1,
    actualHours: props['Actual Hours']?.number ?? 0,
    fixedPrice: props['fixedPrice']?.number ?? null,
    order: props['Order (Sequence)']?.number ?? 1,
    status: props.Status?.select?.name ?? 'Not Started',
    milestoneType: props['Milestone Type']?.select?.name ?? 'Individual',
    dueDate: props['Due Date']?.date?.start ?? null,
    notes: props.Notes?.rich_text?.[0]?.plain_text ?? '',
    includeInEstimate: props.includeInEstimate?.checkbox ?? true,
    urgent: props.urgent?.checkbox ?? false,
    workflowGroupId: props.workflowGroupId?.rich_text?.[0]?.plain_text ?? null,
    workflowName: props.workflowName?.rich_text?.[0]?.plain_text ?? null
  };
}

function mapPart(page) {
  const props = page.properties;
  
  return {
    id: page.id,
    projectId: props['Work Order']?.relation?.[0]?.id || null,
    name: props.Name?.title?.[0]?.plain_text ?? 'Untitled Part',
    quantity: props.Quantity?.number ?? 1,
    pricePerItem: props['Price Per Item']?.number ?? 0,
    order: props['Order']?.number ?? 1
  };
}

// Save complete parts set for a project
async function saveParts(res, notion, partsDbId, data) {
  console.log('saveParts called with partsDbId:', partsDbId ? 'Set' : 'NOT SET');
  console.log('Parts data:', JSON.stringify(data, null, 2));
  
  const { projectId, parts } = data;
  
  // Initialize parts as empty array if not provided
  const partsList = parts || [];
  
  if (!partsDbId) {
    console.warn('Parts database not configured - NOTION_PARTS_DATABASE_ID is not set');
    return res.status(200).json({ 
      success: false, 
      error: 'Parts database not configured',
      message: 'Add NOTION_PARTS_DATABASE_ID environment variable to Vercel to enable parts feature.' 
    });
  }
  
  if (!projectId) {
    console.error('No projectId provided');
    return res.status(400).json({ 
      success: false,
      error: 'Project ID is required' 
    });
  }
  
  try {
    console.log(`Querying parts database ${partsDbId} for project ${projectId}`);
    console.log(`Parts to save: ${partsList.length}`);
    
    const existingResponse = await notion.databases.query({
      database_id: partsDbId,
      filter: {
        property: 'Work Order',
        relation: {
          contains: projectId
        }
      }
    });
    
    console.log(`Found ${existingResponse.results.length} existing parts`);
    
    const existingParts = existingResponse.results.map(mapPart);
    const updates = [];
    
    for (let i = 0; i < partsList.length; i++) {
      const part = partsList[i];
      console.log(`Processing part ${i + 1}:`, part.name);
      
      if (part.id && existingParts.find(p => p.id === part.id)) {
        // Update existing part
        console.log(`Updating existing part: ${part.id}`);
        const updatePromise = notion.pages.update({
          page_id: part.id,
          properties: {
            'Name': { title: [{ text: { content: part.name || 'Unnamed Part' } }] },
            'Quantity': { number: part.quantity || 1 },
            'Price Per Item': { number: part.pricePerItem || 0 },
            'Order': { number: i + 1 }
          }
        });
        updates.push(updatePromise);
      } else {
        // Create new part
        console.log(`Creating new part: ${part.name}`);
        const createPromise = notion.pages.create({
          parent: { database_id: partsDbId },
          properties: {
            'Name': { title: [{ text: { content: part.name || 'Unnamed Part' } }] },
            'Work Order': { relation: [{ id: projectId }] },
            'Quantity': { number: part.quantity || 1 },
            'Price Per Item': { number: part.pricePerItem || 0 },
            'Order': { number: i + 1 }
          }
        });
        updates.push(createPromise);
      }
    }
    
    // Delete parts that are no longer in the list
    const partIds = partsList.filter(p => p.id).map(p => p.id);
    const toDelete = existingParts.filter(p => !partIds.includes(p.id));
    
    console.log(`Deleting ${toDelete.length} removed parts`);
    for (const part of toDelete) {
      const deletePromise = notion.pages.update({
        page_id: part.id,
        archived: true
      });
      updates.push(deletePromise);
    }
    
    console.log(`Executing ${updates.length} database operations`);
    await Promise.all(updates);
    
    console.log('Parts saved successfully');
    return res.json({ 
      success: true, 
      message: `Saved ${partsList.length} parts, deleted ${toDelete.length} parts`
    });
  } catch (error) {
    console.error('Failed to save parts - Full error:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error status:', error.status);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to save parts',
      detail: error.message,
      code: error.code,
      hint: 'Check that NOTION_PARTS_DATABASE_ID is correct and the integration has access to the Parts database'
    });
  }
}

function parseRatingValue(ratingStr) {
  if (!ratingStr) return 3;
  if (typeof ratingStr === 'number') return ratingStr;
  const match = ratingStr.match(/^(\d+)-/);
  return match ? parseInt(match[1]) : 3;
}

// ============================================
// INBOX / TODOS FUNCTIONS
// ============================================

async function getTodos(res, notion, databaseId) {
  if (!databaseId) {
    return res.status(500).json({ error: 'NOTION_INBOX_DATABASE_ID not configured' });
  }

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Done',
        checkbox: {
          equals: false
        }
      },
      sorts: [
        {
          property: 'Created Date',
          direction: 'descending'
        }
      ]
    });

    console.log('Raw todos response:', JSON.stringify(response.results.slice(0, 2), null, 2));

    const todos = response.results.map(page => {
      const props = page.properties;
      
      return {
        id: page.id,
        note: props['Note']?.title?.[0]?.plain_text || '',
        createdDate: props['Created Date']?.created_time || page.created_time,
        done: props['Done']?.checkbox || false,
        list: props['List']?.select?.name || null
      };
    });

    // Filter for empty List - check for any falsy value or the string "null"
    const filteredTodos = todos.filter(t => {
      const listValue = t.list;
      // Check if list is falsy (null, undefined, empty string, false, 0, NaN) or the string "null"
      return !listValue || listValue === 'null';
    });
    
    // Return debug info with ALL todos to see what's happening
    return res.status(200).json({ 
      todos: filteredTodos,
      debug: {
        totalTodos: todos.length,
        filteredTodos: filteredTodos.length,
        sampleTodos: todos.slice(0, 5).map(t => ({
          note: t.note,
          list: t.list,
          listType: typeof t.list
        })),
        allTodosListValues: todos.map(t => ({
          note: t.note.substring(0, 30),
          list: t.list,
          listType: typeof t.list,
          isNull: t.list === null,
          isUndefined: t.list === undefined,
          isEmpty: t.list === '',
          isFalsy: !t.list
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching todos:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch todos',
      detail: error.message
    });
  }
}

async function updateTodo(res, notion, databaseId, data) {
  if (!databaseId) {
    return res.status(500).json({ error: 'NOTION_INBOX_DATABASE_ID not configured' });
  }

  try {
    const { id, done } = data;

    if (!id) {
      return res.status(400).json({ error: 'Todo ID required' });
    }

    const properties = {};
    
    if (done !== undefined) {
      properties['Done'] = { checkbox: done };
    }

    await notion.pages.update({
      page_id: id,
      properties
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Todo updated successfully' 
    });
  } catch (error) {
    console.error('Error updating todo:', error);
    return res.status(500).json({ 
      error: 'Failed to update todo',
      detail: error.message
    });
  }
}

async function createTodo(res, notion, databaseId, data) {
  if (!databaseId) {
    return res.status(500).json({ error: 'NOTION_INBOX_DATABASE_ID not configured' });
  }

  try {
    const { note } = data;

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Todo note is required' });
    }

    const newPage = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        'Note': {
          title: [
            {
              text: {
                content: note.trim()
              }
            }
          ]
        },
        'Done': {
          checkbox: false
        }
        // List field is left empty by default
      }
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Todo created successfully',
      id: newPage.id
    });
  } catch (error) {
    console.error('Error creating todo:', error);
    return res.status(500).json({ 
      error: 'Failed to create todo',
      detail: error.message
    });
  }
}
