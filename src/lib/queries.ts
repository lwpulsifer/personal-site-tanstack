import { queryOptions } from '@tanstack/react-query'
import { getAdminPosts, getAllTags } from '#/server/posts'

export const adminPostsQueryOptions = queryOptions({
  queryKey: ['adminPosts'],
  queryFn: () => getAdminPosts(),
})

export const allTagsQueryOptions = queryOptions({
  queryKey: ['allTags'],
  queryFn: () => getAllTags(),
})
