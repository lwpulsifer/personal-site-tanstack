import { createServerFn } from '@tanstack/react-start'
import { getRequestIP } from '@tanstack/react-start/server'
import { getSupabaseServiceClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'
import { checkRateLimit } from '#/server/rate-limit'
import { z } from 'zod'
import type { MapLocation, MapPhoto, MapSubmission } from '#/lib/map-types'
import type { Tables } from '#/lib/database.types'
import { censorName } from '#/lib/strings'
import tzLookup from 'tz-lookup'
import { isWithinBayArea } from '#/lib/geo'

const DEFAULT_TIME_ZONE = 'America/Los_Angeles'
const LOCATION_MERGE_RADIUS_METERS = 10

function inferTimeZoneFromCoords(coords: { lat: number; lng: number } | null): string {
  if (!coords) return DEFAULT_TIME_ZONE
  try {
    return tzLookup(coords.lat, coords.lng)
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

function localToUtcIso(local: string | null | undefined, timeZone: string): string | null {
  if (!local) return null
  // Parse the local string as if it were UTC (no timezone suffix → UTC)
  const naive = new Date(local)
  if (isNaN(naive.getTime())) return null
  // Compute the offset: how far ahead the target timezone is from UTC at this instant
  const utcStr = naive.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = naive.toLocaleString('en-US', { timeZone })
  const offsetMs = new Date(utcStr).getTime() - new Date(tzStr).getTime()
  // Shift so that the local string is interpreted in the target timezone
  const result = new Date(naive.getTime() + offsetMs)
  return isNaN(result.getTime()) ? null : result.toISOString()
}

function metersToLatDegrees(meters: number) {
  // Rough conversion: 1 deg latitude ≈ 111,111 meters.
  return meters / 111_111
}

function metersToLngDegrees(meters: number, latDegrees: number) {
  const latRad = (latDegrees * Math.PI) / 180
  const denom = 111_111 * Math.max(0.000001, Math.cos(latRad))
  return meters / denom
}

function haversineDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3
  const phi1 = (a.lat * Math.PI) / 180
  const phi2 = (b.lat * Math.PI) / 180
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180
  const dLambda = ((b.lng - a.lng) * Math.PI) / 180

  const x =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}

async function findExistingLocationWithinRadius(opts: {
  supabase: ReturnType<typeof getSupabaseServiceClient>
  mapSlug: string
  coords: { lat: number; lng: number }
  radiusMeters: number
}) {
  const deltaLat = metersToLatDegrees(opts.radiusMeters)
  const deltaLng = metersToLngDegrees(opts.radiusMeters, opts.coords.lat)

  const { data: candidates, error } = await opts.supabase
    .from('map_locations')
    .select('id,lat,lng')
    .eq('map_slug', opts.mapSlug)
    .gte('lat', opts.coords.lat - deltaLat)
    .lte('lat', opts.coords.lat + deltaLat)
    .gte('lng', opts.coords.lng - deltaLng)
    .lte('lng', opts.coords.lng + deltaLng)

  if (error) throw new Error(error.message)
  let best: { id: string; dist: number } | null = null
  for (const c of candidates ?? []) {
    if (typeof (c as any).lat !== 'number' || typeof (c as any).lng !== 'number') continue
    const dist = haversineDistanceMeters(opts.coords, { lat: (c as any).lat, lng: (c as any).lng })
    if (dist <= opts.radiusMeters && (!best || dist < best.dist)) {
      best = { id: (c as any).id, dist }
    }
  }
  return best?.id ?? null
}

// ── Public ────────────────────────────────────────────────────────────────────

export const getApprovedLocations = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ mapSlug: z.string() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServiceClient()
    const { data: locations, error } = await supabase
      .from('map_locations')
      .select('*')
      .eq('map_slug', data.mapSlug)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    // Get photo counts and first photo per location
    const locs = (locations ?? []) as Tables<'map_locations'>[]
    const locationIds = locs.map((l) => l.id)
    const { data: photos } = locationIds.length > 0
      ? await supabase
          .from('map_photos')
          .select('location_id, storage_path, created_at')
          .in('location_id', locationIds)
          .order('created_at', { ascending: true })
      : { data: [] }

    const countMap = new Map<string, number>()
    const thumbMap = new Map<string, string>()
    for (const p of (photos ?? []) as { location_id: string; storage_path: string }[]) {
      countMap.set(p.location_id, (countMap.get(p.location_id) ?? 0) + 1)
      if (!thumbMap.has(p.location_id)) {
        thumbMap.set(p.location_id, p.storage_path)
      }
    }

    // Get submitter names from approved submissions linked to each location
    const { data: submissions } = locationIds.length > 0
      ? await supabase
          .from('map_submissions')
          .select('location_id, submitter_name')
          .in('location_id', locationIds)
          .eq('status', 'approved')
          .order('created_at', { ascending: true })
      : { data: [] }

    const submitterMap = new Map<string, string>()
    for (const s of (submissions ?? []) as { location_id: string; submitter_name: string | null }[]) {
      if (s.submitter_name && !submitterMap.has(s.location_id)) {
        submitterMap.set(s.location_id, s.submitter_name)
      }
    }

    return locs.map((loc) => ({
      ...loc,
      photo_count: countMap.get(loc.id) ?? 0,
      thumbnail_path: thumbMap.get(loc.id) ?? null,
      submitted_by: censorName(submitterMap.get(loc.id) ?? null),
    })) as MapLocation[]
  })

export const getLocationPhotos = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ locationId: z.string() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServiceClient()
    const { data: photos, error } = await supabase
      .from('map_photos')
      .select('*')
      .eq('location_id', data.locationId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const photoRows = (photos ?? []) as Tables<'map_photos'>[]
    const submissionIds = [...new Set(photoRows.map((p) => p.submission_id).filter(Boolean))] as string[]

    const submitterMap = new Map<string, string>()
    if (submissionIds.length > 0) {
      const { data: submissions } = await supabase
        .from('map_submissions')
        .select('id, submitter_name')
        .in('id', submissionIds)
      for (const s of (submissions ?? []) as { id: string; submitter_name: string | null }[]) {
        if (s.submitter_name) submitterMap.set(s.id, s.submitter_name)
      }
    }

    return photoRows.map((p) => ({
      ...p,
      submitted_by: censorName(submitterMap.get(p.submission_id ?? '') ?? null),
    })) as MapPhoto[]
  })

export const submitSighting = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      mapSlug: z.string(),
      locationId: z.string().optional(),
      proposedName: z.string().optional(),
      proposedLat: z.number().optional(),
      proposedLng: z.number().optional(),
      proposedAddress: z.string().optional(),
      occurredAtLocal: z.string().optional(),
      notes: z.string().optional(),
      submitterName: z.string().optional(),
      submitterEmail: z.string().email().optional(),
      photos: z.array(
        z.object({
          storagePath: z.string(),
          takenAtLocal: z.string().optional(),
          exifLat: z.number().optional(),
          exifLng: z.number().optional(),
        }),
      ).default([]),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseServiceClient()

    // Global pending limit
    const { count, error: countError } = await supabase
      .from('map_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (countError) throw new Error(countError.message)
    if ((count ?? 0) >= 100) {
      throw new Error('Too many pending submissions. Please try again later.')
    }

    // Per-IP rate limit
    const ip = getRequestIP({ xForwardedFor: true }) ?? 'unknown'
    const { allowed } = checkRateLimit(ip)
    if (!allowed) {
      throw new Error('You are submitting too quickly. Please wait a moment.')
    }

    const firstPhotoWithCoords =
      data.photos.find((p) => typeof p.exifLat === 'number' && typeof p.exifLng === 'number') ?? null
    const inferredCoords =
      firstPhotoWithCoords
        ? { lat: firstPhotoWithCoords.exifLat as number, lng: firstPhotoWithCoords.exifLng as number }
        : typeof data.proposedLat === 'number' && typeof data.proposedLng === 'number'
          ? { lat: data.proposedLat, lng: data.proposedLng }
          : null

    const submissionTz = inferTimeZoneFromCoords(inferredCoords)

    // Enforce a basic geofence for new sightings. (Adding photos to an existing
    // location is allowed even if EXIF data is missing/odd.)
    if (!data.locationId && inferredCoords && !isWithinBayArea(inferredCoords.lat, inferredCoords.lng)) {
      throw new Error('Please submit sightings within the San Francisco Bay Area.')
    }

    const occurredAtLocal =
      data.occurredAtLocal ??
      data.photos.find((p) => typeof p.takenAtLocal === 'string')?.takenAtLocal ??
      null
    const occurredAt = localToUtcIso(occurredAtLocal, submissionTz)

    const { data: submission, error } = await supabase
      .from('map_submissions')
      .insert({
        map_slug: data.mapSlug,
        location_id: data.locationId ?? null,
        proposed_name: data.proposedName ?? null,
        proposed_lat: data.proposedLat ?? null,
        proposed_lng: data.proposedLng ?? null,
        proposed_address: data.proposedAddress ?? null,
        occurred_at: occurredAt,
        time_zone: submissionTz,
        notes: data.notes ?? null,
        submitter_name: data.submitterName ?? null,
        submitter_email: data.submitterEmail ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    const sub = submission as Tables<'map_submissions'>

    // Link photos to submission — location_id is null until approval
    if (data.photos.length > 0) {
      const photoRows = data.photos.map((p) => {
        const coords =
          typeof p.exifLat === 'number' && typeof p.exifLng === 'number'
            ? { lat: p.exifLat, lng: p.exifLng }
            : null
        const tz = inferTimeZoneFromCoords(coords) ?? submissionTz
        const takenAt = localToUtcIso(p.takenAtLocal ?? null, tz)
        return {
          location_id: data.locationId ?? null,
          submission_id: sub.id,
          event_id: null,
          storage_path: p.storagePath,
          exif_lat: coords?.lat ?? null,
          exif_lng: coords?.lng ?? null,
          taken_at: takenAt,
          time_zone: tz,
        }
      })
      const { error: photoError } = await supabase.from('map_photos').insert(photoRows)
      if (photoError) throw new Error(photoError.message)
    }

    return sub
  })

// ── Admin ─────────────────────────────────────────────────────────────────────

export const getPendingSubmissions = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ mapSlug: z.string().optional() }).optional())
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()

    let query = supabase
      .from('map_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (data?.mapSlug) {
      query = query.eq('map_slug', data.mapSlug)
    }

    const { data: submissions, error } = await query

    if (error) throw new Error(error.message)

    // Fetch photos for each submission
    const subs = (submissions ?? []) as Tables<'map_submissions'>[]
    const submissionIds = subs.map((s) => s.id)
    const { data: photos } = submissionIds.length > 0
      ? await supabase
          .from('map_photos')
          .select('*')
          .in('submission_id', submissionIds)
      : { data: [] }

    const submitterBySubmission = new Map(subs.map((s) => [s.id, s.submitter_name]))

    const photosBySubmission = new Map<string, MapPhoto[]>()
    for (const p of (photos ?? []) as Tables<'map_photos'>[]) {
      if (!p.submission_id) continue
      const enriched: MapPhoto = {
        ...p,
        submitted_by: censorName(submitterBySubmission.get(p.submission_id) ?? null),
      }
      const existing = photosBySubmission.get(p.submission_id) ?? []
      existing.push(enriched)
      photosBySubmission.set(p.submission_id, existing)
    }

    return subs.map((s) => ({
      ...s,
      photos: photosBySubmission.get(s.id) ?? [],
    })) as MapSubmission[]
  })

export const approveSubmission = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ submissionId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseServiceClient()

    // Fetch the submission
    const { data: submission, error: fetchError } = await supabase
      .from('map_submissions')
      .select('*')
      .eq('id', data.submissionId)
      .single()

    if (fetchError || !submission) throw new Error('Submission not found')
    const sub2 = submission as Tables<'map_submissions'>

    let locationId = sub2.location_id

    // If no existing location, try to reuse an existing location within a
    // small radius. Otherwise create a new location from the proposed fields.
    if (!locationId) {
      if (!sub2.proposed_lat || !sub2.proposed_lng) {
        throw new Error('Submission has no coordinates')
      }
      if (!isWithinBayArea(sub2.proposed_lat, sub2.proposed_lng)) {
        throw new Error('Submission coordinates are outside of the San Francisco Bay Area.')
      }

      const existingLocationId = await findExistingLocationWithinRadius({
        supabase,
        mapSlug: sub2.map_slug,
        coords: { lat: sub2.proposed_lat, lng: sub2.proposed_lng },
        radiusMeters: LOCATION_MERGE_RADIUS_METERS,
      })
      if (existingLocationId) {
        locationId = existingLocationId
      } else {
      const { data: newLoc, error: locError } = await supabase
        .from('map_locations')
        .insert({
          map_slug: sub2.map_slug,
          name: sub2.proposed_name ?? 'Unnamed Location',
          lat: sub2.proposed_lat,
          lng: sub2.proposed_lng,
          address: sub2.proposed_address ?? null,
          created_by: user.id,
        })
        .select()
        .single()

      if (locError) throw new Error(locError.message)
      locationId = (newLoc as Tables<'map_locations'>).id
      }
    }

    const occurredAt = sub2.occurred_at ?? sub2.created_at ?? new Date().toISOString()
    const timeZone = sub2.time_zone ?? DEFAULT_TIME_ZONE

    const { data: event, error: eventError } = await supabase
      .from('map_events')
      .insert({
        map_slug: sub2.map_slug,
        location_id: locationId,
        occurred_at: occurredAt,
        time_zone: timeZone,
        notes: sub2.notes ?? null,
        submitter_name: sub2.submitter_name ?? null,
        submitter_email: sub2.submitter_email ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (eventError || !event) throw new Error(eventError?.message ?? 'Could not create event')
    const ev = event as Tables<'map_events'>

    // Link any photos from this submission to the location
    await supabase
      .from('map_photos')
      .update({ location_id: locationId, event_id: ev.id })
      .eq('submission_id', data.submissionId)

    // Mark submission as approved
    const { error: updateError } = await supabase
      .from('map_submissions')
      .update({
        status: 'approved',
        location_id: locationId,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', data.submissionId)

    if (updateError) throw new Error(updateError.message)

    return { ok: true, locationId, eventId: ev.id }
  })

export const rejectSubmission = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ submissionId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('map_submissions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', data.submissionId)

    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const deleteLocation = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('map_locations')
      .delete()
      .eq('id', data.id)

    if (error) throw new Error(error.message)
    return { ok: true }
  })
