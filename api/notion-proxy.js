// Make these two changes in your notion-proxy.js API file:

// CHANGE 1: Update the handleGet function to pass 'req' to getAllData
// Find this function and update the default case:
async function handleGet(req, res, notion) {
  const { action } = req.query;
  const { NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID, NOTION_WORKFLOWS_DATABASE_ID } = process.env;
  
  switch (action) {
    case 'workflows':
      return await getWorkflows(res, notion, NOTION_WORKFLOWS_DATABASE_ID);
    case 'debug-project-schema':
      return await debugProjectSchema(res, notion, NOTION_DATABASE_ID);
    default:
      // ADD 'req' as first parameter here:
      return await getAllData(req, res, notion, NOTION_DATABASE_ID, NOTION_MILESTONES_DATABASE_ID);
  }
}

// CHANGE 2: Replace the entire getAllData function with this version:
async function getAllData(req, res, notion, projectsDbId, milestonesDbId) {
  try {
    // Get the status parameter from query string
    // Default to "On The Bench" if not specified
    const { status } = req.query || {};
    const filterStatus = status || 'On The Bench';
    
    let allProjects = [];
    let hasMore = true;
    let nextCursor = undefined;
    
    while (hasMore) {
      const projectsResponse = await notion.databases.query({
        database_id: projectsDbId,
        filter: {
          property: 'Status',
          select: {
            equals: filterStatus
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
    
    console.log(`API returning ${projects.length} projects with status "${filterStatus}" and ${milestones.length} milestones`);
    
    return res.json({ projects, milestones });
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw new Error(`Failed to fetch data: ${error.message}`);
  }
}

// That's it! After making these changes:
// - Your "On The Bench" page: calls API without params → gets "On The Bench" projects (default)
// - Your "On Deck" page: calls API with ?status=On Deck → gets only "On Deck" projects
// - Efficient and fast - only fetches the data each page actually needs!
