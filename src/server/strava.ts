import { createServerFn } from '@tanstack/react-start'
import { fetchActivities, exchangeCodeForTokens } from '#/lib/strava'
import { STRAVA_TYPE_MAP } from '#/lib/workout-types'
import type { WorkoutType } from '#/lib/workout-types'
import { requireAuth } from '#/server/auth.server'
import { z } from 'zod'

export type StravaActivity = {
  date: string       // YYYY-MM-DD
  type: WorkoutType
  name: string
  distance: number   // meters
  movingTime: number // seconds
  stravaId: number
}

export const getStravaActivitiesForWeek = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ startDate: z.string(), endDate: z.string() }))
  .handler(async ({ data }) => {
    try {
      const after = Math.floor(new Date(`${data.startDate}T00:00:00Z`).getTime() / 1000)
      const before = Math.floor(new Date(`${data.endDate}T23:59:59Z`).getTime() / 1000)
      const activities = await fetchActivities(after, before)

      return activities
        .filter((a) => a.sport_type in STRAVA_TYPE_MAP || a.type in STRAVA_TYPE_MAP)
        .map((a) => ({
          date: a.start_date_local.slice(0, 10),
          type: (STRAVA_TYPE_MAP[a.sport_type] ?? STRAVA_TYPE_MAP[a.type] ?? 'Other') as WorkoutType,
          name: a.name,
          distance: a.distance,
          movingTime: a.moving_time,
          stravaId: a.id,
        })) satisfies StravaActivity[]
    } catch (err) {
      // Strava is optional. "not configured" is expected in dev — log API errors only.
      if (err instanceof Error && !err.message.includes('not configured')) {
        console.error('[Strava] fetchActivities failed:', err.message)
      }
      return [] as StravaActivity[]
    }
  })

export const exchangeStravaCode = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ code: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const tokens = await exchangeCodeForTokens(data.code)
    // Log to server console — user copies refresh_token to .env
    console.log('[Strava OAuth] access_token:', tokens.access_token)
    console.log('[Strava OAuth] refresh_token:', tokens.refresh_token)
    console.log('[Strava OAuth] expires_at:', tokens.expires_at)
    return { success: true, athlete: tokens.athlete?.username ?? null }
  })
