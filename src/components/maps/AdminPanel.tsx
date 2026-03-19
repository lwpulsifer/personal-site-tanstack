import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pendingMapSubmissionsQueryOptions, mapLocationsQueryOptions } from '#/lib/queries'
import { approveSubmission, rejectSubmission } from '#/server/maps'
import type { MapSubmission } from '#/lib/map-types'
import { StorageImage } from './StorageImage'
import { toTestIdPart } from '#/lib/strings'

export function AdminPanel({
	mapSlug,
	onSelectSubmission,
	selectedSubmissionId,
}: {
	mapSlug: string
	onSelectSubmission?: (submission: MapSubmission) => void
	selectedSubmissionId?: string | null
}) {
	const queryClient = useQueryClient()
	const { data: submissions = [], isLoading } = useQuery(pendingMapSubmissionsQueryOptions(mapSlug))

	const approveMutation = useMutation({
		mutationFn: (submissionId: string) => approveSubmission({ data: { submissionId } }),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: pendingMapSubmissionsQueryOptions(mapSlug).queryKey })
			queryClient.invalidateQueries({ queryKey: mapLocationsQueryOptions(mapSlug).queryKey })
			if (result?.locationId) {
				// Refresh gallery when approving submissions for an existing location.
				queryClient.invalidateQueries({ queryKey: ['mapPhotos', result.locationId] })
			}
		},
	})

	const rejectMutation = useMutation({
		mutationFn: (submissionId: string) => rejectSubmission({ data: { submissionId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: pendingMapSubmissionsQueryOptions(mapSlug).queryKey })
		},
	})

	if (isLoading) {
		return <p data-testid="pending-submissions-loading" className="text-sm text-[var(--text-muted)]">Loading submissions...</p>
	}

	if (submissions.length === 0) {
		return (
			<div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
				<p data-testid="no-pending-submissions" className="text-sm text-[var(--text-muted)]">No pending submissions.</p>
			</div>
		)
	}

	return (
		<div className="space-y-3">
			<h3 data-testid="pending-submissions-heading" className="text-sm font-semibold text-[var(--text)]">
				Pending Submissions ({submissions.length})
			</h3>
			{submissions.map((sub) => (
				// Use the proposed name when available so e2e can target cards via stable test IDs.
				// Falls back to the submission id to keep the id unique even if proposed names collide.
				// Example: `submission-card-e2e-test-lion-approve`
				//          `submission-card-0f5d...` (fallback)
				<div
					key={sub.id}
					data-testid={`submission-card-${toTestIdPart(sub.proposed_name ?? sub.id)}`}
					data-submission-id={sub.id}
					onClick={() => onSelectSubmission?.(sub)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault()
							onSelectSubmission?.(sub)
						}
					}}
					role="button"
					tabIndex={0}
					className={`w-full cursor-pointer rounded-xl border bg-[var(--surface)] p-4 text-left transition hover:border-[var(--blue)] ${
						selectedSubmissionId === sub.id
							? "border-[var(--blue)] ring-1 ring-[var(--blue)]"
							: "border-[var(--border)]"
					}`}
				>
					<div className="flex items-start justify-between gap-2">
						<div>
							<p className="m-0 font-semibold text-[var(--text)]">
								{sub.proposed_name ?? 'Unnamed'}
							</p>
							{sub.proposed_address && (
								<p className="m-0 text-xs text-[var(--text-muted)]">{sub.proposed_address}</p>
							)}
							{sub.proposed_lat && sub.proposed_lng && (
								<p className="m-0 text-xs text-[var(--text-muted)]">
									{sub.proposed_lat.toFixed(5)}, {sub.proposed_lng.toFixed(5)}
								</p>
							)}
							{sub.notes && (
								<p className="m-0 mt-1 text-xs text-[var(--text-muted)] italic">{sub.notes}</p>
							)}
							{sub.submitter_name && (
								<p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
									From: {sub.submitter_name} {sub.submitter_email ? `(${sub.submitter_email})` : ''}
								</p>
							)}
						</div>
						<div className="flex shrink-0 gap-2">
							<button
								type="button"
								data-testid="approve-btn"
								onClick={(e) => {
									e.stopPropagation()
									approveMutation.mutate(sub.id)
								}}
								disabled={approveMutation.isPending}
								className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
							>
								Approve
							</button>
							<button
								type="button"
								data-testid="reject-btn"
								onClick={(e) => {
									e.stopPropagation()
									rejectMutation.mutate(sub.id)
								}}
								disabled={rejectMutation.isPending}
								className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
							>
								Reject
							</button>
						</div>
					</div>

					{sub.photos.length > 0 && (
						<div className="mt-3 flex gap-2 overflow-x-auto">
							{sub.photos.map((photo) => (
								<StorageImage
									key={photo.id}
									bucket="map-photos"
									storagePath={photo.storage_path}
									alt="Submission photo"
									className="h-16 w-16 shrink-0 rounded-lg object-cover"
									width={80}
									height={80}
								/>
							))}
						</div>
					)}
				</div>
			))}
		</div>
	)
}
