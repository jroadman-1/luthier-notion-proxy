export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { note } = req.body;

  if (!note || note.trim() === '') {
    return res.status(400).json({ error: 'Missing or empty note' });
  }

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: process.env.NOTION_INBOX_DATABASE_ID },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: note
                }
              }
            ]
          }
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(500).json({ error: 'Failed to create Notion page', detail: error });
    }

    res.status(200).json({ success: true });

  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
