import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useAuth } from "#/lib/auth";
import {
	FREQUENCY_OPTIONS,
	type FriendWithDueStatus,
	frequencyLabel,
} from "#/lib/friends";
import { friendsQueryOptions } from "#/lib/queries";
import {
	createFriend,
	deleteFriend,
	markContacted,
	updateFriend,
} from "#/server/friends";

export const Route = createFileRoute("/friends")({
	head: () => ({ meta: [{ title: "Friends" }] }),
	component: FriendsPage,
});

// ── Main page ────────────────────────────────────────────────────────────────

function FriendsPage() {
	const { isAuthenticated } = useAuth();

	if (!isAuthenticated) {
		return (
			<main className="page-wrap flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-16">
				<div className="island-shell rise-in w-full max-w-sm rounded-[2rem] px-8 py-10 text-center">
					<h1 className="display-title mb-4 text-2xl font-bold text-[var(--text)]">
						Friends
					</h1>
					<p className="mb-6 text-[var(--text-muted)]">
						Sign in to manage your friends list.
					</p>
					<Link
						to="/login"
						className="rounded-full bg-[var(--blue-deep)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)]"
					>
						Sign in
					</Link>
				</div>
			</main>
		);
	}

	return <AuthenticatedFriendsPage />;
}

function AuthenticatedFriendsPage() {
	const queryClient = useQueryClient();
	const { data: friends = [], isLoading } = useQuery(friendsQueryOptions);

	const dueFriends = friends.filter((f) => f.is_due);
	const allFriends = friends;

	const markMutation = useMutation({
		mutationFn: (id: string) => markContacted({ data: { id } }),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: friendsQueryOptions.queryKey,
			}),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteFriend({ data: { id } }),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: friendsQueryOptions.queryKey,
			}),
	});

	return (
		<main className="page-wrap px-4 pb-8 pt-14">
			<section className="mb-6">
				<p className="island-kicker mb-2">Stay in touch</p>
				<h1 className="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
					Friends
				</h1>
			</section>

			{isLoading ? (
				<p className="text-[var(--text-muted)]">Loading...</p>
			) : (
				<>
					<DueTodaySection
						friends={dueFriends}
						onMarkContacted={(id) => markMutation.mutate(id)}
						isPending={markMutation.isPending}
					/>
					<AddFriendForm />
					<AllFriendsSection
						friends={allFriends}
						onMarkContacted={(id) => markMutation.mutate(id)}
						onDelete={(id) => deleteMutation.mutate(id)}
						markPending={markMutation.isPending}
						deletePending={deleteMutation.isPending}
					/>
				</>
			)}
		</main>
	);
}

// ── Due Today ────────────────────────────────────────────────────────────────

function DueTodaySection({
	friends,
	onMarkContacted,
	isPending,
}: {
	friends: FriendWithDueStatus[];
	onMarkContacted: (id: string) => void;
	isPending: boolean;
}) {
	if (friends.length === 0) {
		return (
			<section className="island-shell rise-in mb-8 rounded-2xl px-6 py-5">
				<h2 className="mb-2 text-lg font-semibold text-[var(--text)]">
					Reach out today
				</h2>
				<p className="text-[var(--text-muted)]">
					You're all caught up! No one to contact today.
				</p>
			</section>
		);
	}

	const grouped = groupByTag(friends);

	return (
		<section className="island-shell rise-in mb-8 rounded-2xl px-6 py-5">
			<h2 className="mb-4 text-lg font-semibold text-[var(--text)]">
				Reach out today ({friends.length})
			</h2>
			{Object.entries(grouped).map(([tag, tagFriends]) => (
				<div key={tag} className="mb-4 last:mb-0">
					<p className="island-kicker mb-2 capitalize">{tag}</p>
					<div className="flex flex-wrap gap-2">
						{tagFriends.map((f) => (
							<div
								key={f.id}
								className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2"
							>
								<span className="text-sm font-medium text-[var(--text)]">
									{f.name}
								</span>
								<span className="text-xs text-[var(--text-muted)]">
									{frequencyLabel(f.frequency_days)}
								</span>
								<button
									type="button"
									onClick={() => onMarkContacted(f.id)}
									disabled={isPending}
									className="rounded-full bg-[var(--blue-deep)] px-3 py-1 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50"
								>
									Done
								</button>
							</div>
						))}
					</div>
				</div>
			))}
		</section>
	);
}

// ── Add Friend Form ──────────────────────────────────────────────────────────

function AddFriendForm() {
	const id = useId();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [tag, setTag] = useState("friend");
	const [frequencyDays, setFrequencyDays] = useState(7);
	const [notes, setNotes] = useState("");
	const [showNotes, setShowNotes] = useState(false);

	const mutation = useMutation({
		mutationFn: () =>
			createFriend({
				data: {
					name,
					tag,
					frequency_days: frequencyDays,
					...(notes ? { notes } : {}),
				},
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: friendsQueryOptions.queryKey,
			});
			setName("");
			setTag("friend");
			setFrequencyDays(7);
			setNotes("");
			setShowNotes(false);
		},
	});

	return (
		<section className="mb-8">
			<h2 className="mb-3 text-lg font-semibold text-[var(--text)]">
				Add a friend
			</h2>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (name.trim()) mutation.mutate();
				}}
				className="flex flex-wrap items-end gap-3"
			>
				<div className="flex flex-col gap-1">
					<label
						htmlFor={`${id}-name`}
						className="text-xs font-semibold text-[var(--text-muted)]"
					>
						Name
					</label>
					<input
						id={`${id}-name`}
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						placeholder="Alice"
						className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)]"
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label
						htmlFor={`${id}-tag`}
						className="text-xs font-semibold text-[var(--text-muted)]"
					>
						Type
					</label>
					<select
						id={`${id}-tag`}
						value={tag}
						onChange={(e) => setTag(e.target.value)}
						className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)]"
					>
						<option value="friend">Friend</option>
						<option value="family">Family</option>
						<option value="colleague">Colleague</option>
					</select>
				</div>

				<div className="flex flex-col gap-1">
					<label
						htmlFor={`${id}-frequency`}
						className="text-xs font-semibold text-[var(--text-muted)]"
					>
						Frequency
					</label>
					<select
						id={`${id}-frequency`}
						value={frequencyDays}
						onChange={(e) => setFrequencyDays(Number(e.target.value))}
						className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)]"
					>
						{FREQUENCY_OPTIONS.map((opt) => (
							<option key={opt.days} value={opt.days}>
								{opt.label}
							</option>
						))}
					</select>
				</div>

				{showNotes ? (
					<div className="flex w-full flex-col gap-1">
						<label
							htmlFor={`${id}-notes`}
							className="text-xs font-semibold text-[var(--text-muted)]"
						>
							Notes
						</label>
						<textarea
							id={`${id}-notes`}
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Optional notes..."
							rows={2}
							className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)]"
						/>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setShowNotes(true)}
						className="text-sm text-[var(--text-muted)] underline"
					>
						+ Notes
					</button>
				)}

				<button
					type="submit"
					disabled={mutation.isPending || !name.trim()}
					className="rounded-full bg-[var(--blue-deep)] px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50 disabled:hover:translate-y-0"
				>
					{mutation.isPending ? "Adding..." : "Add"}
				</button>
			</form>
		</section>
	);
}

// ── All Friends ──────────────────────────────────────────────────────────────

function AllFriendsSection({
	friends,
	onMarkContacted,
	onDelete,
	markPending,
	deletePending,
}: {
	friends: FriendWithDueStatus[];
	onMarkContacted: (id: string) => void;
	onDelete: (id: string) => void;
	markPending: boolean;
	deletePending: boolean;
}) {
	const [editingId, setEditingId] = useState<string | null>(null);

	if (friends.length === 0) {
		return (
			<section>
				<h2 className="mb-3 text-lg font-semibold text-[var(--text)]">
					All friends
				</h2>
				<p className="text-[var(--text-muted)]">
					No friends added yet. Add one above!
				</p>
			</section>
		);
	}

	return (
		<section>
			<h2 className="mb-3 text-lg font-semibold text-[var(--text)]">
				All friends ({friends.length})
			</h2>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-[var(--border)] text-left text-xs font-semibold text-[var(--text-muted)]">
							<th className="pb-2 pr-4">Name</th>
							<th className="pb-2 pr-4">Type</th>
							<th className="pb-2 pr-4">Frequency</th>
							<th className="pb-2 pr-4">Last contacted</th>
							<th className="pb-2 pr-4">Status</th>
							<th className="pb-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						{friends.map((f) =>
							editingId === f.id ? (
								<EditFriendRow
									key={f.id}
									friend={f}
									onCancel={() => setEditingId(null)}
									onSaved={() => setEditingId(null)}
								/>
							) : (
								<tr
									key={f.id}
									className="border-b border-[var(--border)] last:border-0"
								>
									<td className="py-3 pr-4 font-medium text-[var(--text)]">
										{f.name}
									</td>
									<td className="py-3 pr-4 capitalize text-[var(--text-muted)]">
										{f.tag}
									</td>
									<td className="py-3 pr-4 text-[var(--text-muted)]">
										{frequencyLabel(f.frequency_days)}
									</td>
									<td className="py-3 pr-4 text-[var(--text-muted)]">
										{f.last_contacted_at
											? new Date(f.last_contacted_at).toLocaleDateString()
											: "Never"}
									</td>
									<td className="py-3 pr-4">
										{f.is_due ? (
											<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
												Due
											</span>
										) : (
											<span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-300">
												OK
											</span>
										)}
									</td>
									<td className="py-3">
										<div className="flex gap-1.5">
											{f.is_due && (
												<button
													type="button"
													onClick={() => onMarkContacted(f.id)}
													disabled={markPending}
													className="rounded-full bg-[var(--blue-deep)] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
												>
													Done
												</button>
											)}
											<button
												type="button"
												onClick={() => setEditingId(f.id)}
												className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface)]"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() => onDelete(f.id)}
												disabled={deletePending}
												className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
											>
												Delete
											</button>
										</div>
									</td>
								</tr>
							),
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
}

// ── Edit inline row ──────────────────────────────────────────────────────────

function EditFriendRow({
	friend,
	onCancel,
	onSaved,
}: {
	friend: FriendWithDueStatus;
	onCancel: () => void;
	onSaved: () => void;
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState(friend.name);
	const [tag, setTag] = useState(friend.tag);
	const [frequencyDays, setFrequencyDays] = useState(friend.frequency_days);
	const [notes, setNotes] = useState(friend.notes ?? "");

	const mutation = useMutation({
		mutationFn: () =>
			updateFriend({
				data: {
					id: friend.id,
					name,
					tag,
					frequency_days: frequencyDays,
					...(notes ? { notes } : {}),
				},
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: friendsQueryOptions.queryKey,
			});
			onSaved();
		},
	});

	return (
		<tr className="border-b border-[var(--border)]">
			<td className="py-2 pr-2">
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
				/>
			</td>
			<td className="py-2 pr-2">
				<select
					value={tag}
					onChange={(e) => setTag(e.target.value)}
					className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
				>
					<option value="friend">Friend</option>
					<option value="family">Family</option>
					<option value="colleague">Colleague</option>
				</select>
			</td>
			<td className="py-2 pr-2">
				<select
					value={frequencyDays}
					onChange={(e) => setFrequencyDays(Number(e.target.value))}
					className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
				>
					{FREQUENCY_OPTIONS.map((opt) => (
						<option key={opt.days} value={opt.days}>
							{opt.label}
						</option>
					))}
				</select>
			</td>
			<td colSpan={2} className="py-2 pr-2">
				<input
					type="text"
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					placeholder="Notes..."
					className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
				/>
			</td>
			<td className="py-2">
				<div className="flex gap-1.5">
					<button
						type="button"
						onClick={() => mutation.mutate()}
						disabled={mutation.isPending || !name.trim()}
						className="rounded-full bg-[var(--blue-deep)] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
					>
						Save
					</button>
					<button
						type="button"
						onClick={onCancel}
						className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface)]"
					>
						Cancel
					</button>
				</div>
			</td>
		</tr>
	);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupByTag(
	friends: FriendWithDueStatus[],
): Record<string, FriendWithDueStatus[]> {
	const grouped: Record<string, FriendWithDueStatus[]> = {};
	for (const f of friends) {
		if (!grouped[f.tag]) grouped[f.tag] = [];
		grouped[f.tag].push(f);
	}
	return grouped;
}
