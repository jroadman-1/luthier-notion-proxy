// Vercel serverless function
export default async function handler(req, res) {
  const { note } = req.body;

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.DATABASE_ID;

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28"
    },
    body: JSON.stringify({
      parent: { database_id: DATABASE_ID },
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
    return res.status(500).json({ error: "Failed to create Notion page" });
  }

  res.status(200).json({ success: true });
}
