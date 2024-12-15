import { type Handler, schedule } from '@netlify/functions'
import { getNewItems } from './util/notion'
import { slackApi, blocks } from './util/slack'

const postNewItemsToSlack: Handler = async () => {
  const items = await getNewItems()

  await slackApi('chat.postMessage', {
    channel: process.env.SLACK_CHANNEL_ID,
    blocks: [
      blocks.section({
        text: [
          `New trip votes in Notion!`,
          '',
          ...items.map(
            (item) => `- ${item.country} - ${item.activity} - ${item.comment} `
          ),
          '',
          `See all items <https://notion.com/${process.env.NOTION_DATABASE_ID}|in Notion>`,
        ].join('\n'),
      }),
    ],
  })
}

export const handler = schedule('*/5 * * * *', postNewItemsToSlack)
