import type { Enums, Tables } from '#/lib/database.types'

export type MapLocation = Tables<'map_locations'> & {
  photo_count: number
  thumbnail_path: string | null
}

export type MapEvent = Tables<'map_events'>

export type MapSubmissionStatus = Enums<'map_submission_status'>

export type MapSubmission = Tables<'map_submissions'> & { photos: MapPhoto[] }

export type MapPhoto = Tables<'map_photos'>
