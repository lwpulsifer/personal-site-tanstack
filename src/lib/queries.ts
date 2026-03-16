import { queryOptions } from '@tanstack/react-query'
import { getAdminPosts, getAllTags } from '#/server/posts'
import { getNowPlaying } from '#/server/spotify'
import { getPageViews } from '#/server/pageViews'
import { getApprovedLocations, getLocationPhotos, getPendingSubmissions } from '#/server/maps'

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

// ── Maps ─────────────────────────────────────────────────────────────────────

export const mapLocationsQueryOptions = (mapSlug: string) =>
  queryOptions({
    queryKey: ['mapLocations', mapSlug],
    queryFn: () => getApprovedLocations({ data: { mapSlug } }),
  })

export const mapPhotosQueryOptions = (locationId: string) =>
  queryOptions({
    queryKey: ['mapPhotos', locationId],
    queryFn: () => getLocationPhotos({ data: { locationId } }),
  })

export const pendingMapSubmissionsQueryOptions = (mapSlug?: string) =>
  queryOptions({
    queryKey: ['pendingMapSubmissions', mapSlug],
    queryFn: () => getPendingSubmissions({ data: { mapSlug } }),
  })
