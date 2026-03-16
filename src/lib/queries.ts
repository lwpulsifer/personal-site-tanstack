import { queryOptions } from '@tanstack/react-query'
import { getAdminPosts, getAllTags } from '#/server/posts'
import { getNowPlaying } from '#/server/spotify'
import { getPageViews } from '#/server/pageViews'
import { getApprovedLocations, getLocationPhotos, getPendingSubmissions } from '#/server/lions'

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

// ── Lions ─────────────────────────────────────────────────────────────────────

export const lionLocationsQueryOptions = queryOptions({
  queryKey: ['lionLocations'],
  queryFn: () => getApprovedLocations(),
})

export const lionPhotosQueryOptions = (locationId: string) =>
  queryOptions({
    queryKey: ['lionPhotos', locationId],
    queryFn: () => getLocationPhotos({ data: { locationId } }),
  })

export const pendingLionSubmissionsQueryOptions = queryOptions({
  queryKey: ['pendingLionSubmissions'],
  queryFn: () => getPendingSubmissions(),
})
