const TOKEN_ENDPOINT = 'https://www.strava.com/oauth/token'
const ACTIVITIES_ENDPOINT = 'https://www.strava.com/api/v3/athlete/activities'

async function getAccessToken(): Promise<string> {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Strava env vars not configured')
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(`Strava token exchange failed: ${response.status}`)
  }

  const data = await response.json()
  return data.access_token as string
}

export type StravaActivityRaw = {
  id: number
  name: string
  type: string
  sport_type: string
  start_date_local: string
  distance: number
  moving_time: number
}

export async function fetchActivities(
  after: number,
  before: number,
): Promise<StravaActivityRaw[]> {
  const accessToken = await getAccessToken()

  const url = new URL(ACTIVITIES_ENDPOINT)
  url.searchParams.set('after', String(after))
  url.searchParams.set('before', String(before))
  url.searchParams.set('per_page', '50')

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Strava activities fetch failed: ${response.status}`)
  }

  return response.json()
}

export async function exchangeCodeForTokens(code: string) {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set')
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    throw new Error(`Strava code exchange failed: ${response.status}`)
  }

  return response.json()
}
