import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppData, Bid, Grade, Officer, Position, Post, RuleConfig } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

/** Loads the whole dataset from Supabase. Returns null when no project is configured. */
export async function loadRemote(): Promise<{ data: AppData; rules: RuleConfig | null } | null> {
  if (!supabase) return null;
  const [posts, positions, officers, bids, cycle] = await Promise.all([
    supabase.from("posts").select("*"),
    supabase.from("positions").select("*"),
    supabase.from("officers").select("*"),
    supabase.from("bids").select("*"),
    supabase.from("cycles").select("*").eq("is_active", true).maybeSingle(),
  ]);
  const err = posts.error || positions.error || officers.error || bids.error;
  if (err) throw err;
  return {
    data: {
      posts: (posts.data ?? []).map(
        (r): Post => ({
          id: r.id, city: r.city, country: r.country, region: r.region, subregion: r.subregion,
          lat: r.lat, lng: r.lng, type: r.post_type, hardship: r.hardship_pct, language: r.language, tourYears: r.tour_years,
        }),
      ),
      positions: (positions.data ?? []).map(
        (r): Position => ({
          id: r.id, postId: r.post_id, grade: r.grade as Grade, title: r.title, specialty: r.specialty, languageReq: r.language_req,
        }),
      ),
      officers: (officers.data ?? []).map(
        (r): Officer => ({
          id: r.id, name: r.display_name, grade: r.grade as Grade, languages: r.languages ?? [],
          positionId: r.position_id, ted: r.ted, lastHardship: r.last_hardship_year,
          training: r.onward_position_id
            ? { language: r.training_language, until: r.training_until, onwardPositionId: r.onward_position_id }
            : null,
        }),
      ),
      bids: (bids.data ?? []).map((r): Bid => ({ officerId: r.officer_id, positionId: r.position_id, rank: r.rank })),
      submitted: [...new Set((bids.data ?? []).filter((r) => r.submitted_at).map((r) => r.officer_id as string))],
    },
    rules: (cycle.data?.rules as RuleConfig | undefined) ?? null,
  };
}
