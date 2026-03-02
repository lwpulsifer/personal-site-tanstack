import { queryOptions } from '@tanstack/react-query'
import { getAdminPosts, getAllTags } from '#/server/posts'
import { getNowPlaying } from '#/server/spotify'
import { getPageViews } from '#/server/pageViews'
import { getWorkoutsForWeek } from '#/server/workouts'
import { getStravaActivitiesForWeek } from '#/server/strava'
import { getEvents } from '#/server/events'

export const adminPostsQueryOptions = queryOptions({
  queryKey: ['adminPosts'],
  queryFn: () => getAdminPosts(),
})

export const allTagsQueryOptions = queryOptions({
  queryKey: ['allTags'],
  queryFn: () => getAllTags(),
})

export const nowPlayingQueryOptions = queryOptions({
  queryKey: ['nowPlaying'],
  queryFn: () => getNowPlaying(),
  refetchInterval: 30_000,
  retry: false,
})

export const pageViewsQueryOptions = (key: string) =>
  queryOptions({
    queryKey: ['pageViews', key],
    queryFn: () => getPageViews({ data: { url: key } }),
  })

// Base key used for targeted invalidation across all week windows.
export const WORKOUTS_QUERY_KEY = ['workouts'] as const

export const workoutsQueryOptions = (startDate: string) =>
  queryOptions({
    queryKey: [...WORKOUTS_QUERY_KEY, startDate],
    queryFn: () => getWorkoutsForWeek({ data: { startDate } }),
  })

export const stravaActivitiesQueryOptions = (startDate: string, endDate: string) =>
  queryOptions({
    queryKey: ['stravaActivities', startDate, endDate],
    queryFn: () => getStravaActivitiesForWeek({ data: { startDate, endDate } }),
    staleTime: 5 * 60_000,
    retry: false,
  })

export const EVENTS_QUERY_KEY = ['events'] as const

export const eventsQueryOptions = queryOptions({
  queryKey: EVENTS_QUERY_KEY,
  queryFn: () => getEvents(),
  staleTime: 10 * 60_000,
})
