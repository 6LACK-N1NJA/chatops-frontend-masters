import type { HandlerEvent } from '@netlify/functions'
import { createHmac } from 'node:crypto'

export async function slackApi(
  endpoint: SlackApiEndpoint,
  body: SlackApiRequestBody
) {
  return fetch(`https://slack.com/api/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_OAUTH_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  }).then((res) => res.json())
}

export function verifySlackRequst(req: HandlerEvent) {
  const secret = process.env.SLACK_SIGNIN_SECRET!
  const signature = req.headers['x-slack-signature']
  const timestamp = Number(req.headers['x-slack-request-timestamp'])
  const now = Math.floor(Date.now() / 1000)

  if (Math.abs(now - timestamp) > 300) return false

  const hash = createHmac('sha256', secret)
    .update(`v0:${timestamp}:${req.body}`)
    .digest('hex')

  return `v0=${hash}` === signature
}

export const blocks = {
  section: ({ text }: SectionBlockArgs): SlackBlockSection => ({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text,
    },
  }),
  input: ({
    id,
    label,
    placeholder,
    initial_value = '',
    hint = '',
  }: InputBlockArgs): SlackBlockInput => ({
    type: 'input',
    block_id: `${id}_block`,
    label: {
      type: 'plain_text',
      text: label,
    },
    element: {
      action_id: id,
      type: 'plain_text_input',
      placeholder: {
        type: 'plain_text',
        text: placeholder,
      },
      initial_value,
    },
    hint: {
      type: 'plain_text',
      text: hint,
    },
  }),
  select: ({
    id,
    label,
    placeholder,
    options,
  }: SelectBlockArgs): SlackBlockInput => ({
    block_id: `${id}_block`,
    type: 'input',
    label: {
      type: 'plain_text',
      text: label,
    },
    element: {
      action_id: id,
      type: 'static_select',
      placeholder: {
        type: 'plain_text',
        text: placeholder,
        emoji: true,
      },
      options: options.map(({ label, value }) => ({
        text: {
          type: 'plain_text',
          text: label,
          emoji: true,
        },
        value,
      })),
    },
  }),
}

export function modal({
  trigger_id,
  id,
  title,
  submit_text,
  blocks,
}: ModalArgs) {
  return {
    trigger_id,
    view: {
      type: 'modal',
      callback_id: id,
      title: {
        type: 'plain_text',
        text: title,
      },
      submit: {
        type: 'plain_text',
        text: submit_text,
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
        emoji: true,
      },
      blocks,
    },
  }
}
