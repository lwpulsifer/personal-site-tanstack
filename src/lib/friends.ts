/**
 * Pure functions for the friends tracker due-date logic.
 *
 * Uses a deterministic probabilistic algorithm so contacts with the same
 * frequency don't all become due on the same day.
 */

export const FREQUENCY_OPTIONS = [
	{ label: "Daily", days: 1 },
	{ label: "Weekly", days: 7 },
	{ label: "Monthly", days: 30 },
	{ label: "Quarterly", days: 90 },
	{ label: "Yearly", days: 365 },
] as const;

export function frequencyLabel(days: number): string {
	return FREQUENCY_OPTIONS.find((o) => o.days === days)?.label ?? `${days}d`;
}

const MS_PER_DAY = 86_400_000;

/**
 * Simple deterministic hash that turns a string into a float in [0, 1).
 * Uses FNV-1a-inspired multiply-xor on each char code.
 */
function deterministicRandom(seed: string): number {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	// Convert to unsigned 32-bit, then to [0, 1)
	return ((h >>> 0) % 10000) / 10000;
}

/**
 * Given a contact's UUID and the number of days since their anchor date,
 * determine whether they are due for contact today.
 *
 * For daily frequency: always due.
 * For others: escalating probability window from 60% to 130% of frequency.
 *
 * We check each day in the window up to and including `daysSinceAnchor`.
 * The contact becomes due on the first day where the hash value falls
 * below the escalating probability threshold.
 */
export function isDue(
	contactId: string,
	frequencyDays: number,
	daysSinceAnchor: number,
): boolean {
	if (frequencyDays <= 1) return daysSinceAnchor >= 1;

	const windowStart = Math.floor(frequencyDays * 0.6);
	const hardDeadline = Math.floor(frequencyDays * 1.3);
	const windowSize = frequencyDays * 0.8;

	if (daysSinceAnchor < windowStart) return false;
	if (daysSinceAnchor >= hardDeadline) return true;

	// Check each day from windowStart up to daysSinceAnchor
	const checkUntil = Math.min(daysSinceAnchor, hardDeadline - 1);
	for (let d = windowStart; d <= checkUntil; d++) {
		const probability = (d - windowStart) / windowSize;
		const rand = deterministicRandom(`${contactId}:${d}`);
		if (rand < probability) return true;
	}

	return false;
}

/**
 * Compute the due date for a contact. Returns the absolute day number
 * (days since epoch) on which the contact first becomes due.
 * Returns null if the contact has no anchor date.
 */
export function computeDueDay(
	contactId: string,
	frequencyDays: number,
	anchorDate: Date | null,
): Date | null {
	if (!anchorDate) return null;

	if (frequencyDays <= 1) {
		return new Date(anchorDate.getTime() + MS_PER_DAY);
	}

	const windowStart = Math.floor(frequencyDays * 0.6);
	const hardDeadline = Math.floor(frequencyDays * 1.3);
	const windowSize = frequencyDays * 0.8;

	for (let d = windowStart; d < hardDeadline; d++) {
		const probability = (d - windowStart) / windowSize;
		const rand = deterministicRandom(`${contactId}:${d}`);
		if (rand < probability) {
			return new Date(anchorDate.getTime() + d * MS_PER_DAY);
		}
	}

	// Hard deadline
	return new Date(anchorDate.getTime() + hardDeadline * MS_PER_DAY);
}

export type FriendWithDueStatus = {
	id: string;
	user_id: string;
	name: string;
	tag: string;
	frequency_days: number;
	last_contacted_at: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
	is_due: boolean;
	due_date: string | null;
};

/**
 * Enrich a raw friend row with computed `is_due` and `due_date` fields.
 */
export function enrichFriend(
	friend: Omit<FriendWithDueStatus, "is_due" | "due_date">,
	now: Date,
): FriendWithDueStatus {
	const anchorDate = friend.last_contacted_at
		? new Date(friend.last_contacted_at)
		: new Date(friend.created_at);

	const daysSinceAnchor = Math.floor(
		(now.getTime() - anchorDate.getTime()) / MS_PER_DAY,
	);

	const due = isDue(friend.id, friend.frequency_days, daysSinceAnchor);
	const dueDate = computeDueDay(friend.id, friend.frequency_days, anchorDate);

	return {
		...friend,
		is_due: due,
		due_date: dueDate?.toISOString() ?? null,
	};
}
