import { queryOptions } from '@tanstack/react-query'
import { getAdminPosts, getAllTags } from '#/server/posts'
import { getNowPlaying } from '#/server/spotify'
import { getPageViews } from '#/server/pageViews'

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
