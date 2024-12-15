interface NotionItem {
  properties: {
    submitter: { rich_text: [{ plain_text: string }] }
    Status: { status: { name: string } }
    country: { select: { name: string } }
    activity: { select: { name: string } }
    comment: { rich_text: [{ plain_text: string }] }
  }
}

export async function notionApi(endpoint: string, body: any) {
  const res = await fetch(`https://api.notion.com/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  }).catch((err) => console.error(err))

  if (!res || !res.ok) {
    console.error(res)
  }

  const data = await res?.json()
  return data
}

function tripItemMapper(item: NotionItem): TripItem {
  return {
    submitter: item.properties.submitter.rich_text[0].plain_text,
    status: item.properties.Status.status.name,
    country: item.properties.country.select.name,
    activity: item.properties.activity.select.name,
    comment: item.properties.comment.rich_text[0].plain_text,
  }
}

export async function getNewItems(): Promise<TripItem[]> {
  const data = await notionApi(
    `databases/${process.env.NOTION_DATABASE_ID}/query`,
    {
      filter: {
        property: 'Status',
        status: {
          equals: 'New',
        },
      },
      page_size: 100,
    }
  )
  return data.results.map(tripItemMapper)
}

export async function saveTripItem(item: TripItem): Promise<void> {
  const res = await notionApi(`pages`, {
    parent: { database_id: process.env.NOTION_DATABASE_ID },
    properties: {
      country: {
        select: {
          name: item.country,
        },
      },
      activity: {
        select: {
          name: item.activity,
        },
      },
      comment: {
        rich_text: [
          {
            text: {
              content: item.comment,
            },
          },
        ],
      },
      submitter: {
        rich_text: [
          {
            text: {
              content: `@${item.submitter} on Slack`,
            },
          },
        ],
      },
    },
  })
  if (!res.ok) {
    console.error(res)
  }
}
