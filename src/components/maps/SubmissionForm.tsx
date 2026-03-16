import { useState, useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitSighting } from '#/server/maps'
import { extractGpsFromImage } from '#/lib/exif'
import { getSupabaseBrowserClient } from '#/lib/supabase'
import { mapLocationsQueryOptions, pendingMapSubmissionsQueryOptions } from '#/lib/queries'

function isHeicFile(file: File) {
  const name = file.name.toLowerCase()
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

async function convertHeicToJpeg(file: File) {
  const { default: heic2any } = await import('heic2any')
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  })
  const jpegBlob = Array.isArray(converted) ? converted[0] : converted
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
  return new File([jpegBlob as BlobPart], newName, { type: 'image/jpeg' })
}

export function SubmissionForm({
  mapSlug,
  onClose,
  initialLat,
  initialLng,
  onCoordsChange,
}: {
  mapSlug: string
  onClose: () => void
  initialLat?: number
  initialLng?: number
  onCoordsChange?: (lat: number, lng: number) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState(initialLat?.toString() ?? '')
  const [lng, setLng] = useState(initialLng?.toString() ?? '')
  const [notes, setNotes] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const previewsRef = useRef<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      setUploading(true)
      setError(null)

      // Upload photos to Supabase Storage
      const storagePaths: string[] = []
      if (files.length > 0) {
        const supabase = getSupabaseBrowserClient()
        for (const file of files) {
          const ext = file.name.split('.').pop() ?? 'jpg'
          const path = `submissions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('map-photos')
            .upload(path, file, { contentType: file.type })
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
          storagePaths.push(path)
        }
      }

      return submitSighting({
        data: {
          mapSlug,
          proposedName: name || undefined,
          proposedLat: lat ? Number.parseFloat(lat) : undefined,
          proposedLng: lng ? Number.parseFloat(lng) : undefined,
          proposedAddress: address || undefined,
          notes: notes || undefined,
          submitterName: submitterName || undefined,
          submitterEmail: submitterEmail || undefined,
          photoStoragePaths: storagePaths,
        },
      })
    },
    onSuccess: () => {
      setSuccess(true)
      setUploading(false)
      queryClient.invalidateQueries({ queryKey: mapLocationsQueryOptions(mapSlug).queryKey })
      // If an authenticated user is viewing the map (admin panel visible), refresh
      // pending submissions so the new item appears immediately.
      queryClient.invalidateQueries({ queryKey: pendingMapSubmissionsQueryOptions(mapSlug).queryKey })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setUploading(false)
    },
  })

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])

    // Convert HEIC/HEIF to JPEG so photos render in all browsers.
    setConverting(true)
    const processed: File[] = []
    try {
      for (const file of selected) {
        if (isHeicFile(file)) {
          try {
            processed.push(await convertHeicToJpeg(file))
          } catch {
            // If conversion fails, keep the original and show an error so the user can retry.
            processed.push(file)
            setError('Could not convert a HEIC photo to JPEG. Try a different photo or browser.')
          }
        } else {
          processed.push(file)
        }
      }
    } finally {
      setConverting(false)
    }

    setFiles(processed)

    // Generate preview URLs (revoke old ones via ref to avoid stale closure)
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url))
    const newPreviews = processed.map((f) => URL.createObjectURL(f))
    previewsRef.current = newPreviews
    setPreviews(newPreviews)

    // Try to extract GPS from first image
    if (selected.length > 0 && !lat && !lng) {
      const coords = await extractGpsFromImage(selected[0])
      if (coords) {
        setLat(coords.lat.toString())
        setLng(coords.lng.toString())
        onCoordsChange?.(coords.lat, coords.lng)
      }
    }
  }, [lat, lng, onCoordsChange])

  if (success) {
    return (
      <div className="island-shell rounded-2xl p-6" data-testid="submission-success">
        <h3 className="m-0 text-lg font-bold text-[var(--text)]">Thanks for your submission!</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Your lion sighting has been submitted for review. It will appear on the map once approved.
        </p>
        <button
          type="button"
          data-testid="submission-close-btn"
          onClick={onClose}
          className="mt-4 rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="island-shell rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 data-testid="submission-form-heading" className="m-0 text-lg font-bold text-[var(--text)]">Report a Lion Sighting</h3>
        <button type="button" data-testid="close-form-btn" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
          &times;
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
        className="space-y-3"
      >
        <div>
          <label htmlFor="lion-name" className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
            Name / Description
          </label>
          <input
            id="lion-name"
            data-testid="field-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Golden lion at Palace of Fine Arts"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
          />
        </div>

        <div>
          <label htmlFor="lion-address" className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
            Address
          </label>
          <input
            id="lion-address"
            data-testid="field-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 3301 Lyon St, San Francisco"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lion-lat" className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Latitude
            </label>
            <input
              id="lion-lat"
              data-testid="field-lat"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => {
                setLat(e.target.value)
                const parsed = Number.parseFloat(e.target.value)
                const lngParsed = Number.parseFloat(lng)
                if (!Number.isNaN(parsed) && !Number.isNaN(lngParsed)) {
                  onCoordsChange?.(parsed, lngParsed)
                }
              }}
              placeholder="37.7749"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
            />
          </div>
          <div>
            <label htmlFor="lion-lng" className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Longitude
            </label>
            <input
              id="lion-lng"
              data-testid="field-lng"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => {
                setLng(e.target.value)
                const parsed = Number.parseFloat(e.target.value)
                const latParsed = Number.parseFloat(lat)
                if (!Number.isNaN(parsed) && !Number.isNaN(latParsed)) {
                  onCoordsChange?.(latParsed, parsed)
                }
              }}
              placeholder="-122.4194"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
            />
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          Tip: click on the map to set coordinates, or upload a photo with GPS data.
        </p>

        <div>
          <label htmlFor="lion-photos" className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
            Photos
          </label>
          <input
            id="lion-photos"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="w-full text-sm text-[var(--text)]"
          />
          {converting && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Converting HEIC photos to JPEG for compatibility...
            </p>
          )}
          {previews.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {previews.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={`Upload preview ${i + 1}`}
                  className="h-20 w-20 shrink-0 rounded-lg object-cover border border-[var(--border)]"
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="lion-notes" className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
            Notes
          </label>
          <textarea
            id="lion-notes"
            data-testid="field-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any additional details..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lion-submitter-name" className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Your Name (optional)
            </label>
            <input
              id="lion-submitter-name"
              type="text"
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
            />
          </div>
          <div>
            <label htmlFor="lion-submitter-email" className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Your Email (optional)
            </label>
            <input
              id="lion-submitter-email"
              type="email"
              value={submitterEmail}
              onChange={(e) => setSubmitterEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          data-testid="submit-sighting-btn"
          disabled={uploading}
          className="w-full rounded-full bg-[var(--blue-deep)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50"
        >
          {uploading ? 'Submitting...' : 'Submit Sighting'}
        </button>
      </form>
    </div>
  )
}
