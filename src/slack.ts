import type { Handler } from '@netlify/functions'
import { parse } from 'querystring'
import { slackApi, verifySlackRequst } from './util/slack'

async function handleSlashCommandf(payload: SlackSlashCommandPayload) {
  const { command, channel_id, text } = payload
  switch (command) {
    case '/watch':
      const movie = await (
        await fetch(
          `http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&t=${text}`
        )
      ).json()
      let message: string
      if (movie.Response === 'False') {
        message = 'There is no such a movie found'
      } else {
        message = `${movie.Title} - ${movie.Year}
${movie.Plot}`
      }
      const res = await slackApi('chat.postMessage', {
        channel: channel_id,
        text: message,
      })
      if (!res.ok) {
        console.log('ERROR', res)
      }
      break
    default:
      return {
        statusCode: 200,
        body: `Unknown command: ${command}`,
      }
  }
  return {
    statusCode: 200,
    body: '',
  }
}

export const handler: Handler = async (event) => {
  const valid = verifySlackRequst(event)
  if (!valid) {
    console.log('Invalid/unathorized request')
    return {
      statusCode: 401,
      body: 'Invalid/unathorized request',
    }
  }

  const body = parse(event.body ?? '') as SlackPayload
  if (body.command) return handleSlashCommandf(body as SlackSlashCommandPayload)

  // TODO handle interactivity (e.g. context commands, modals)

  return {
    statusCode: 200,
    body: 'TODO: handle Slack commands and interactivity',
  }
}
