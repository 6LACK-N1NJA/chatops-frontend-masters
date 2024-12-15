import type { Handler } from '@netlify/functions'
import { parse } from 'querystring'
import { blocks, modal, slackApi, verifySlackRequst } from './util/slack'
import { saveTripItem } from './util/notion'

interface Movie {
  Response: string
  Title: string
  Year: string
  Plot: string
}

interface SlackCommandHandlers {
  [key: string]: (payload: any) => Promise<any>
}

const OMDB_API_BASE_URL = 'http://www.omdbapi.com'
const COUNTRY_OPTIONS = [
  'Spain',
  'Tailand',
  'Montenegro',
  'Morocco',
  'Italy',
  'Greece',
  'Turkey',
  'Malta',
  'Tunis',
  'Portugal',
  'Croatia',
].map(createCountryOption)

const ACTIVITY_OPTIONS = [
  { label: 'Lay on a beach', value: 'beach' },
  { label: 'Surfing, diving, etc.', value: 'extreme' },
  { label: 'Take a road and and see everything', value: 'road' },
  { label: 'Into the wild', value: 'hiking' },
  { label: 'Sex, drugs and rock-n-roll', value: 'hardore' },
  { label: 'Food, wine and nothing else', value: 'food' },
]

function createCountryOption(country: string): {
  value: string
  label: string
} {
  return { value: country, label: country }
}

async function fetchMovie(title: string): Promise<Movie> {
  const response = await fetch(
    `${OMDB_API_BASE_URL}/?apikey=${process.env.OMDB_API_KEY}&t=${title}`
  )
  return response.json()
}

async function handleWatchCommand(payload: any) {
  const movie = await fetchMovie(payload.text)
  const message =
    movie.Response === 'False'
      ? 'There is no such a movie found'
      : `${movie.Title} - ${movie.Year}\n${movie.Plot}`

  const res = await slackApi('chat.postMessage', {
    channel: payload.channel_id,
    text: message,
  })

  if (!res.ok) {
    console.log('ERROR', res)
  }
  return res
}

async function handleTeamTripCommand(payload: any) {
  const tripModal = createTripModal(payload.trigger_id)
  return await slackApi('views.open', tripModal)
}

function createTripModal(triggerId: string) {
  return modal({
    id: 'trip_modal',
    title: 'Select the trip',
    trigger_id: triggerId,
    submit_text: 'Vote',
    blocks: [
      blocks.section({
        text: "*The next team trip is comming!* Choose our destiny and how we'll have fun.",
      }),
      blocks.select({
        id: 'trip_country',
        label: 'Pick a country',
        placeholder: 'Narnia',
        options: COUNTRY_OPTIONS,
      }),
      blocks.select({
        id: 'trip_activity',
        label: 'Pick an activity',
        placeholder: 'Kill zombies',
        options: ACTIVITY_OPTIONS,
      }),
      blocks.input({
        id: 'trip_comment',
        label: 'Comments and wiches',
        placeholder: 'Give me a glock',
        hint: 'What do you prefer?',
      }),
    ],
  })
}

const commandHandlers: SlackCommandHandlers = {
  '/watch': handleWatchCommand,
  '/teamtrip': handleTeamTripCommand,
}

async function handleCommand(command: string, payload: any) {
  const handler = commandHandlers[command]

  if (!handler) {
    return {
      statusCode: 200,
      body: `Unknown command: ${command}`,
    }
  }

  await handler(payload)
  return {
    statusCode: 200,
    body: ''
  }
}

async function handleActivity(payload: SlackModalPayload) {
  const callback_id = payload.callback_id ?? payload.view.callback_id
  switch (callback_id) {
    case 'trip_modal':
      const { values } = payload.view.state
      const fields = {
        country: values.trip_country_block.trip_country.selected_option.value,
        activity: values.trip_activity_block.trip_activity.selected_option.value,
        comment: values.trip_comment_block.trip_comment.value,
        submitter: payload.user.username,
      }
      await saveTripItem(fields)
      await slackApi('chat.postMessage', {
        channel: 'C085J3UL7FB',
        text: `Whoa! <@${payload.user.id}> has voted for our trip! ${values.trip_activity_block.trip_activity.selected_option.text.text}`,
      })
      break
    case 'request-watch':
      const { channel, user, message } = payload
      await slackApi('chat.postMessage', {
        channel: channel?.id,
        thread_ts: message.thread_ts ?? message.ts,
        text: `Hey <@${user.id}>, run /watch to find a movie in the main channel`,
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

  if (body.command) return handleCommand(body.command, body)

  if (body.payload) return handleActivity(JSON.parse(body.payload))

  return {
    statusCode: 200,
    body: 'TODO: handle Slack commands and interactivity',
  }
}
