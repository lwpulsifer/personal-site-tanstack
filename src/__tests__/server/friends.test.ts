import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient } from "#/lib/supabase";
import { requireAuth } from "#/server/auth.server";

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		const builder: {
			inputValidator: (s: unknown) => typeof builder;
			handler: (fn: unknown) => unknown;
		} = {
			inputValidator: () => builder,
			handler: (fn) => fn,
		};
		return builder;
	},
}));

vi.mock("#/lib/supabase", () => ({
	getSupabaseClient: vi.fn(),
}));

vi.mock("#/server/auth.server", () => ({
	requireAuth: vi.fn(),
}));

const { getFriends, createFriend, updateFriend, deleteFriend, markContacted } =
	await import("#/server/friends");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChain(resolved: { data: unknown; error: unknown }) {
	const chain: Record<string, unknown> = {};
	for (const method of [
		"select",
		"order",
		"eq",
		"single",
		"insert",
		"update",
		"delete",
	]) {
		chain[method] = vi.fn(() => chain);
	}
	// biome-ignore lint/suspicious/noThenProperty: thenable chain for Supabase mock
	// biome-ignore lint/complexity/useLiteralKeys: dynamic assignment
	chain["then"] = (resolve: (v: unknown) => void) =>
		Promise.resolve(resolved).then(resolve);
	return chain;
}

function mockClient(
	...chains: ReturnType<typeof makeChain>[]
): ReturnType<typeof getSupabaseClient> {
	const from = vi.fn();
	for (const chain of chains) from.mockReturnValueOnce(chain);
	return { from } as unknown as ReturnType<typeof getSupabaseClient>;
}

const mockUser = { id: "user-123" };

const sampleFriend = {
	id: "friend-1",
	user_id: "user-123",
	name: "Alice",
	tag: "friend",
	frequency_days: 7,
	last_contacted_at: null,
	notes: null,
	created_at: "2026-01-01T12:00:00Z",
	updated_at: "2026-01-01T12:00:00Z",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getFriends", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns enriched friends for the authenticated user", async () => {
		vi.mocked(requireAuth).mockResolvedValue(mockUser as never);
		vi.mocked(getSupabaseClient).mockReturnValue(
			mockClient(makeChain({ data: [sampleFriend], error: null })),
		);

		const result = await (
			getFriends as () => Promise<{ name: string; is_due: boolean }[]>
		)();

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Alice");
		expect(typeof result[0].is_due).toBe("boolean");
	});

	it("throws when the caller is not authenticated", async () => {
		vi.mocked(requireAuth).mockRejectedValue(new Error("Unauthorized"));

		await expect((getFriends as () => Promise<unknown>)()).rejects.toThrow(
			"Unauthorized",
		);
	});

	it("throws when the database returns an error", async () => {
		vi.mocked(requireAuth).mockResolvedValue(mockUser as never);
		vi.mocked(getSupabaseClient).mockReturnValue(
			mockClient(makeChain({ data: null, error: { message: "DB error" } })),
		);

		await expect((getFriends as () => Promise<unknown>)()).rejects.toThrow(
			"DB error",
		);
	});
});

describe("createFriend", () => {
	beforeEach(() => vi.clearAllMocks());

	it("inserts a friend with the authenticated user's id", async () => {
		vi.mocked(requireAuth).mockResolvedValue(mockUser as never);
		const chain = makeChain({ data: sampleFriend, error: null });
		vi.mocked(getSupabaseClient).mockReturnValue(mockClient(chain));

		type CreateInput = (a: {
			data: { name: string; tag: string; frequency_days: number };
		}) => Promise<unknown>;
		await (createFriend as CreateInput)({
			data: { name: "Alice", tag: "friend", frequency_days: 7 },
		});

		expect(chain.insert).toHaveBeenCalledWith(
			expect.objectContaining({ user_id: "user-123", name: "Alice" }),
		);
	});

	it("throws when not authenticated", async () => {
		vi.mocked(requireAuth).mockRejectedValue(new Error("Unauthorized"));

		type CreateInput = (a: {
			data: { name: string; tag: string; frequency_days: number };
		}) => Promise<unknown>;
		await expect(
			(createFriend as CreateInput)({
				data: { name: "Alice", tag: "friend", frequency_days: 7 },
			}),
		).rejects.toThrow("Unauthorized");
	});
});

describe("updateFriend", () => {
	beforeEach(() => vi.clearAllMocks());

	it("scopes the update to the authenticated user", async () => {
		vi.mocked(requireAuth).mockResolvedValue(mockUser as never);
		const chain = makeChain({ data: sampleFriend, error: null });
		vi.mocked(getSupabaseClient).mockReturnValue(mockClient(chain));

		type UpdateInput = (a: {
			data: {
				id: string;
				name: string;
				tag: string;
				frequency_days: number;
			};
		}) => Promise<unknown>;
		await (updateFriend as UpdateInput)({
			data: {
				id: "friend-1",
				name: "Alice B",
				tag: "family",
				frequency_days: 30,
			},
		});

		expect(chain.eq).toHaveBeenCalledWith("id", "friend-1");
		expect(chain.eq).toHaveBeenCalledWith("user_id", "user-123");
	});
});

describe("deleteFriend", () => {
	beforeEach(() => vi.clearAllMocks());

	it("scopes the delete to the authenticated user", async () => {
		vi.mocked(requireAuth).mockResolvedValue(mockUser as never);
		const chain = makeChain({ data: null, error: null });
		vi.mocked(getSupabaseClient).mockReturnValue(mockClient(chain));

		type DeleteInput = (a: { data: { id: string } }) => Promise<unknown>;
		await (deleteFriend as DeleteInput)({ data: { id: "friend-1" } });

		expect(chain.delete).toHaveBeenCalled();
		expect(chain.eq).toHaveBeenCalledWith("id", "friend-1");
		expect(chain.eq).toHaveBeenCalledWith("user_id", "user-123");
	});
});

describe("markContacted", () => {
	beforeEach(() => vi.clearAllMocks());

	it("updates last_contacted_at for the given friend", async () => {
		vi.mocked(requireAuth).mockResolvedValue(mockUser as never);
		const chain = makeChain({ data: null, error: null });
		vi.mocked(getSupabaseClient).mockReturnValue(mockClient(chain));

		type MarkInput = (a: { data: { id: string } }) => Promise<unknown>;
		await (markContacted as MarkInput)({ data: { id: "friend-1" } });

		expect(chain.update).toHaveBeenCalledWith(
			expect.objectContaining({
				last_contacted_at: expect.any(String),
			}),
		);
		expect(chain.eq).toHaveBeenCalledWith("id", "friend-1");
		expect(chain.eq).toHaveBeenCalledWith("user_id", "user-123");
	});
});
