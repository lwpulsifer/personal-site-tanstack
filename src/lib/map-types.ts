export type MapLocation = {
  id: string
  map_slug: string
  name: string
  description: string | null
  address: string | null
  lat: number
  lng: number
  created_at: string
  updated_at: string
  created_by: string | null
  photo_count: number
}

export type MapEvent = {
  id: string
  map_slug: string
  location_id: string
  occurred_at: string
  time_zone: string
  notes: string | null
  submitter_name: string | null
  submitter_email: string | null
  created_by: string | null
  created_at: string
}

export type MapSubmissionStatus = 'pending' | 'approved' | 'rejected'

export type MapSubmission = {
  id: string
  map_slug: string
  location_id: string | null
  proposed_name: string | null
  proposed_lat: number | null
  proposed_lng: number | null
  proposed_address: string | null
  occurred_at: string | null
  time_zone: string | null
  notes: string | null
  submitter_name: string | null
  submitter_email: string | null
  status: MapSubmissionStatus
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
  photos: MapPhoto[]
}

export type MapPhoto = {
  id: string
  location_id: string | null
  submission_id: string | null
  event_id: string | null
  storage_path: string
  caption: string | null
  exif_lat: number | null
  exif_lng: number | null
  taken_at: string | null
  time_zone: string | null
  created_at: string
}
