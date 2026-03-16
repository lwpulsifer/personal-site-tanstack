import { createServerFn } from '@tanstack/react-start'
import { getSupabaseClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'
import { z } from 'zod'
import type { LionLocation, LionPhoto, LionSubmission } from '#/lib/lion-types'

// ── Public ────────────────────────────────────────────────────────────────────

export const getApprovedLocations = createServerFn({ method: 'GET' }).handler(
  async () => {
    const supabase = getSupabaseClient()
    const { data: locations, error } = await supabase
      .from('lion_locations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    // Get photo counts per location
    const { data: photos } = await supabase
      .from('lion_photos')
      .select('location_id')

    const countMap = new Map<string, number>()
    for (const p of photos ?? []) {
      countMap.set(p.location_id, (countMap.get(p.location_id) ?? 0) + 1)
    }

    return (locations ?? []).map((loc) => ({
      ...loc,
      photo_count: countMap.get(loc.id) ?? 0,
    })) as LionLocation[]
  },
)

export const getLocationPhotos = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ locationId: z.string() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseClient()
    const { data: photos, error } = await supabase
      .from('lion_photos')
      .select('*')
      .eq('location_id', data.locationId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (photos ?? []) as LionPhoto[]
  })

export const submitLionSighting = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      locationId: z.string().optional(),
      proposedName: z.string().optional(),
      proposedLat: z.number().optional(),
      proposedLng: z.number().optional(),
      proposedAddress: z.string().optional(),
      notes: z.string().optional(),
      submitterName: z.string().optional(),
      submitterEmail: z.string().email().optional(),
      photoStoragePaths: z.array(z.string()).default([]),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseClient()

    const { data: submission, error } = await supabase
      .from('lion_submissions')
      .insert({
        location_id: data.locationId ?? null,
        proposed_name: data.proposedName ?? null,
        proposed_lat: data.proposedLat ?? null,
        proposed_lng: data.proposedLng ?? null,
        proposed_address: data.proposedAddress ?? null,
        notes: data.notes ?? null,
        submitter_name: data.submitterName ?? null,
        submitter_email: data.submitterEmail ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    // Link photos to submission (they need a location_id, use the existing one
    // or a placeholder — photos get re-linked on approval)
    if (data.photoStoragePaths.length > 0 && data.locationId) {
      const photoRows = data.photoStoragePaths.map((path) => ({
        location_id: data.locationId!,
        submission_id: submission.id,
        storage_path: path,
      }))
      await supabase.from('lion_photos').insert(photoRows)
    }

    return submission
  })

// ── Admin ─────────────────────────────────────────────────────────────────────

export const getPendingSubmissions = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAuth()
    const supabase = getSupabaseClient()

    const { data: submissions, error } = await supabase
      .from('lion_submissions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    // Fetch photos for each submission
    const submissionIds = (submissions ?? []).map((s) => s.id)
    const { data: photos } = submissionIds.length > 0
      ? await supabase
          .from('lion_photos')
          .select('*')
          .in('submission_id', submissionIds)
      : { data: [] }

    const photosBySubmission = new Map<string, LionPhoto[]>()
    for (const p of photos ?? []) {
      if (!p.submission_id) continue
      const existing = photosBySubmission.get(p.submission_id) ?? []
      existing.push(p as LionPhoto)
      photosBySubmission.set(p.submission_id, existing)
    }

    return (submissions ?? []).map((s) => ({
      ...s,
      photos: photosBySubmission.get(s.id) ?? [],
    })) as LionSubmission[]
  },
)

export const approveSubmission = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ submissionId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()

    // Fetch the submission
    const { data: submission, error: fetchError } = await supabase
      .from('lion_submissions')
      .select('*')
      .eq('id', data.submissionId)
      .single()

    if (fetchError || !submission) throw new Error('Submission not found')

    let locationId = submission.location_id

    // If no existing location, create one from proposed fields
    if (!locationId) {
      if (!submission.proposed_lat || !submission.proposed_lng) {
        throw new Error('Submission has no coordinates')
      }
      const { data: newLoc, error: locError } = await supabase
        .from('lion_locations')
        .insert({
          name: submission.proposed_name ?? 'Unnamed Lion',
          lat: submission.proposed_lat,
          lng: submission.proposed_lng,
          address: submission.proposed_address ?? null,
          created_by: user.id,
        })
        .select()
        .single()

      if (locError) throw new Error(locError.message)
      locationId = newLoc.id
    }

    // Link any photos from this submission to the location
    await supabase
      .from('lion_photos')
      .update({ location_id: locationId })
      .eq('submission_id', data.submissionId)

    // Mark submission as approved
    const { error: updateError } = await supabase
      .from('lion_submissions')
      .update({
        status: 'approved',
        location_id: locationId,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', data.submissionId)

    if (updateError) throw new Error(updateError.message)

    return { ok: true, locationId }
  })

export const rejectSubmission = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ submissionId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('lion_submissions')
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
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('lion_locations')
      .delete()
      .eq('id', data.id)

    if (error) throw new Error(error.message)
    return { ok: true }
  })
