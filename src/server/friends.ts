import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { FriendWithDueStatus } from "#/lib/friends";
import { enrichFriend } from "#/lib/friends";
import { getSupabaseClient } from "#/lib/supabase";
import { requireAuth } from "#/server/auth.server";

export type { FriendWithDueStatus };

// ── Read ─────────────────────────────────────────────────────────────────────

export const getFriends = createServerFn({ method: "GET" }).handler(
	async () => {
		const user = await requireAuth();
		const supabase = getSupabaseClient();
		const { data, error } = await supabase
			.from("friends")
			.select("*")
			.eq("user_id", user.id)
			.order("name");

		if (error) throw new Error(error.message);

		const now = new Date();
		return (data ?? []).map((f) => enrichFriend(f, now));
	},
);

// ── Create ───────────────────────────────────────────────────────────────────

export const createFriend = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({
			name: z.string().min(1),
			tag: z.string().min(1).default("friend"),
			frequency_days: z.number().int().min(1),
			notes: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const user = await requireAuth();
		const supabase = getSupabaseClient();
		const { data: friend, error } = await supabase
			.from("friends")
			.insert({
				user_id: user.id,
				name: data.name,
				tag: data.tag,
				frequency_days: data.frequency_days,
				notes: data.notes ?? null,
			})
			.select()
			.single();

		if (error) throw new Error(error.message);
		return friend;
	});

// ── Update ───────────────────────────────────────────────────────────────────

export const updateFriend = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1),
			tag: z.string().min(1),
			frequency_days: z.number().int().min(1),
			notes: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const user = await requireAuth();
		const supabase = getSupabaseClient();
		const { data: friend, error } = await supabase
			.from("friends")
			.update({
				name: data.name,
				tag: data.tag,
				frequency_days: data.frequency_days,
				notes: data.notes ?? null,
			})
			.eq("id", data.id)
			.eq("user_id", user.id)
			.select()
			.single();

		if (error) throw new Error(error.message);
		return friend;
	});

// ── Delete ───────────────────────────────────────────────────────────────────

export const deleteFriend = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const user = await requireAuth();
		const supabase = getSupabaseClient();
		const { error } = await supabase
			.from("friends")
			.delete()
			.eq("id", data.id)
			.eq("user_id", user.id);

		if (error) throw new Error(error.message);
		return { ok: true };
	});

// ── Mark contacted ───────────────────────────────────────────────────────────

export const markContacted = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const user = await requireAuth();
		const supabase = getSupabaseClient();
		const { error } = await supabase
			.from("friends")
			.update({ last_contacted_at: new Date().toISOString() })
			.eq("id", data.id)
			.eq("user_id", user.id);

		if (error) throw new Error(error.message);
		return { ok: true };
	});
