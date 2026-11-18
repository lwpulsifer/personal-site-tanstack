import { queryOptions } from '@tanstack/react-query'
import { getBook, getBooks } from '#/server/books'
import {
  getApprovedLocations,
  getLocationPhotos,
  getPendingSubmissions,
} from '#/server/maps'
import { getPageViews } from '#/server/pageViews'
import type { DbConnection, DbPerson } from '#/server/people'
import { getPeopleGraph, searchPeople } from '#/server/people'
import { getAdminPosts, getAllTags } from '#/server/posts'
import { getNowPlaying } from '#/server/spotify'

export type PeopleGraphData = {
  people: DbPerson[]
  connections: DbConnection[]
}

export const adminPostsQueryOptions = queryOptions({
  queryKey: ['adminPosts'],
  queryFn: () => getAdminPosts(),
})

export const allTagsQueryOptions = queryOptions({
  queryKey: ['allTags'],
  queryFn: () => getAllTags(),
})

export const booksQueryOptions = queryOptions({
  queryKey: ['books'],
  queryFn: () => getBooks(),
})

// Nested under the same 'books' key as booksQueryOptions (rather than a
// separate top-level 'book' key) so that invalidating booksQueryOptions
// anywhere (e.g. AdminActions' status-change/delete mutations, which only
// know about the list query) also invalidates this one via React Query's
// default prefix-matching — otherwise a book's own page silently keeps
// showing stale data after a quick action changes it elsewhere.
export const bookQueryOptions = (bookId: string) =>
  queryOptions({
    queryKey: ['books', bookId],
    queryFn: () => getBook({ data: { bookId } }),
  })

export const peopleGraphQueryOptions = queryOptions({
  queryKey: ['peopleGraph'],
  queryFn: () => getPeopleGraph(),
})

export const searchPeopleQueryOptions = (query = '', limit = 100, offset = 0) =>
  queryOptions({
    queryKey: ['searchPeople', query, limit, offset],
    queryFn: () => searchPeople({ data: { query, limit, offset } }),
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
