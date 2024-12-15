import type { Handler } from '@netlify/functions'
import { parse } from 'querystring'
import { blocks, modal, slackApi, verifySlackRequst } from './util/slack'
import { channel } from 'diagnostics_channel'
import { text } from 'stream/consumers'

function createCountryOption(country: string): {
  value: string
  label: string
} {
  return { value: country, label: country }
}

async function handleSlashCommand(payload: SlackSlashCommandPayload) {
  const { command, channel_id, text } = payload
  let res
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
      res = await slackApi('chat.postMessage', {
        channel: channel_id,
        text: message,
      })
      if (!res.ok) {
        console.log('ERROR', res)
      }
      break
    case '/teamtrip':
      const mod = modal({
        id: 'trip_modal',
        title: 'Select the trip',
        trigger_id: payload.trigger_id,
        submit_text: 'Vote',
        blocks: [
          blocks.section({
            text: "*The next team trip is comming!* Choose our destiny and how we'll have fun.",
          }),
          blocks.select({
            id: 'trip_country',
            label: 'Pick a country',
            placeholder: 'Narnia',
            options: [
              createCountryOption('Spain'),
              createCountryOption('Tailand'),
              createCountryOption('Montenegro'),
              createCountryOption('Morocco'),
              createCountryOption('Italy'),
              createCountryOption('Greece'),
              createCountryOption('Turkey'),
              createCountryOption('Malta'),
              createCountryOption('Tunis'),
              createCountryOption('Portugal'),
            ],
          }),
          blocks.select({
            id: 'trip_activity',
            label: 'Pick an activity',
            placeholder: 'Kill zombies',
            options: [
              { label: 'Lay on a beach', value: 'beach' },
              { label: 'Surfing, diving, etc.', value: 'extreme' },
              { label: 'Take a road and and see everything', value: 'road' },
              { label: 'Into the wild', value: 'hiking' },
              { label: 'Sex, drugs and rock-n-roll', value: 'hardore' },
              { label: 'Food, wine and nothing else', value: 'food' },
            ],
          }),
          blocks.input({
            id: 'trip_comment',
            label: 'Comments and wiches',
            placeholder: 'Give me a glock',
            hint: 'What do you prefer?',
          }),
        ],
      })
      res = await slackApi('views.open', mod)
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

async function handleActivity(payload: SlackModalPayload) {
  const callback_id = payload.callback_id ?? payload.view.callback_id
  switch (callback_id) {
    case 'trip_modal':
      const { values } = payload.view.state
      const fields = {
        country: values.trip_country_block.trip_country.selected_option,
        activity: values.trip_activity_block.trip_activity.selected_option,
        comment: values.trip_comment_block.trip_comment.value,
      }
      await slackApi('chat.postMessage', {
        channel: 'C085J3UL7FB',
        text: `Whoa! <@${payload.user.id}> has voted for our trip! ${fields.activity.text.text}`,
      })
      break
    case 'request-watch':
      const { channel, user, message } = payload
	  await slackApi('chat.postMessage', {
		channel: channel?.id,
		thread_ts: message.thread_ts ?? message.ts,
		text: `Hey <@${user.id}>, run /watch to find a movie in the main channel`
	  })
      break
    default:
      console.log(`Unknown callback id ${callback_id}`)
      return {
        statusCode: 400,
        body: `Unknown callback id ${callback_id}`,
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

  if (body.command) return handleSlashCommand(body as SlackSlashCommandPayload)

  if (body.payload) return handleActivity(JSON.parse(body.payload))

  return {
    statusCode: 200,
    body: 'TODO: handle Slack commands and interactivity',
  }
}
