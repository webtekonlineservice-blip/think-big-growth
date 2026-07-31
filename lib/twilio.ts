import twilio from 'twilio'

let client: ReturnType<typeof twilio> | null = null

export function getTwilioClient(): ReturnType<typeof twilio> {
  if (client) return client

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    throw new Error(
      'Missing Twilio environment variables. ' +
        'Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.'
    )
  }

  client = twilio(accountSid, authToken)
  return client
}

export async function sendSms(to: string, body: string): Promise<void> {
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!from) throw new Error('TWILIO_PHONE_NUMBER is not set.')

  const twilioClient = getTwilioClient()
  await twilioClient.messages.create({ to, from, body })
}
