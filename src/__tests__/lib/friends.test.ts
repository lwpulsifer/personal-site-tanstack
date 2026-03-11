import { describe, expect, it } from "vitest";
import {
	computeDueDay,
	enrichFriend,
	FREQUENCY_OPTIONS,
	frequencyLabel,
	isDue,
} from "#/lib/friends";

const MS_PER_DAY = 86_400_000;

describe("frequencyLabel", () => {
	it("returns human-readable labels for known frequencies", () => {
		expect(frequencyLabel(1)).toBe("Daily");
		expect(frequencyLabel(7)).toBe("Weekly");
		expect(frequencyLabel(30)).toBe("Monthly");
		expect(frequencyLabel(90)).toBe("Quarterly");
		expect(frequencyLabel(365)).toBe("Yearly");
	});

	it("returns a fallback for unknown frequencies", () => {
		expect(frequencyLabel(14)).toBe("14d");
	});
});

describe("isDue", () => {
	const id = "550e8400-e29b-41d4-a716-446655440000";

	it("daily contacts are always due after 1 day", () => {
		expect(isDue(id, 1, 0)).toBe(false);
		expect(isDue(id, 1, 1)).toBe(true);
		expect(isDue(id, 1, 5)).toBe(true);
	});

	it("is never due before the window starts (60% of frequency)", () => {
		// Weekly: window starts at day 4
		expect(isDue(id, 7, 0)).toBe(false);
		expect(isDue(id, 7, 1)).toBe(false);
		expect(isDue(id, 7, 2)).toBe(false);
		expect(isDue(id, 7, 3)).toBe(false);
	});

	it("is always due at the hard deadline (130% of frequency)", () => {
		// Weekly: hard deadline = floor(7 * 1.3) = 9
		expect(isDue(id, 7, 9)).toBe(true);
		// Monthly: hard deadline = floor(30 * 1.3) = 39
		expect(isDue(id, 30, 39)).toBe(true);
	});

	it("is deterministic for the same contact and day", () => {
		const result1 = isDue(id, 30, 25);
		const result2 = isDue(id, 30, 25);
		expect(result1).toBe(result2);
	});

	it("different contacts get different due dates", () => {
		const ids = Array.from(
			{ length: 100 },
			(_, i) => `id-${i.toString().padStart(3, "0")}`,
		);
		const dueDays = ids.map((contactId) => {
			for (let d = 0; d <= 40; d++) {
				if (isDue(contactId, 30, d)) return d;
			}
			return 40;
		});

		const unique = new Set(dueDays);
		// With 100 contacts and a ~21-day window (18-39), we should see multiple distinct due days
		expect(unique.size).toBeGreaterThan(5);
	});

	it("once due, remains due on subsequent days", () => {
		// Find the first day this contact becomes due for monthly
		let firstDueDay = -1;
		for (let d = 0; d <= 39; d++) {
			if (isDue(id, 30, d)) {
				firstDueDay = d;
				break;
			}
		}
		expect(firstDueDay).toBeGreaterThan(0);

		// All subsequent days should also be due
		for (let d = firstDueDay; d <= 45; d++) {
			expect(isDue(id, 30, d)).toBe(true);
		}
	});
});

describe("computeDueDay", () => {
	it("returns null for a null anchor date", () => {
		expect(computeDueDay("id", 7, null)).toBeNull();
	});

	it("returns anchor + 1 day for daily frequency", () => {
		const anchor = new Date("2026-01-01T12:00:00Z");
		const result = computeDueDay("id", 1, anchor);
		expect(result?.getTime()).toBe(anchor.getTime() + MS_PER_DAY);
	});

	it("returns a date within the expected window", () => {
		const anchor = new Date("2026-01-01T12:00:00Z");
		const result = computeDueDay("some-uuid", 30, anchor);
		expect(result).not.toBeNull();
		const daysDiff =
			((result as Date).getTime() - anchor.getTime()) / MS_PER_DAY;

		// Should be between window start (18) and hard deadline (39)
		expect(daysDiff).toBeGreaterThanOrEqual(18);
		expect(daysDiff).toBeLessThanOrEqual(39);
	});
});

describe("enrichFriend", () => {
	const baseFriend = {
		id: "550e8400-e29b-41d4-a716-446655440000",
		user_id: "user-1",
		name: "Alice",
		tag: "friend",
		frequency_days: 7,
		last_contacted_at: null as string | null,
		notes: null,
		created_at: "2026-01-01T12:00:00Z",
		updated_at: "2026-01-01T12:00:00Z",
	};

	it("uses created_at as anchor when last_contacted_at is null", () => {
		// 30 days later — well past weekly hard deadline, so should be due
		const now = new Date("2026-01-31T12:00:00Z");
		const result = enrichFriend(baseFriend, now);

		expect(result.is_due).toBe(true);
		expect(result.due_date).toBeTruthy();
	});

	it("uses last_contacted_at as anchor when available", () => {
		// Contacted yesterday — not due yet for weekly
		const now = new Date("2026-01-02T12:00:00Z");
		const friend = {
			...baseFriend,
			last_contacted_at: "2026-01-01T12:00:00Z",
		};
		const result = enrichFriend(friend, now);

		expect(result.is_due).toBe(false);
	});

	it("preserves all original fields", () => {
		const now = new Date("2026-01-02T12:00:00Z");
		const result = enrichFriend(baseFriend, now);

		expect(result.name).toBe("Alice");
		expect(result.tag).toBe("friend");
		expect(result.frequency_days).toBe(7);
	});
});

describe("FREQUENCY_OPTIONS", () => {
	it("has exactly 5 options", () => {
		expect(FREQUENCY_OPTIONS).toHaveLength(5);
	});

	it("options are in ascending order of days", () => {
		for (let i = 1; i < FREQUENCY_OPTIONS.length; i++) {
			expect(FREQUENCY_OPTIONS[i].days).toBeGreaterThan(
				FREQUENCY_OPTIONS[i - 1].days,
			);
		}
	});
});
