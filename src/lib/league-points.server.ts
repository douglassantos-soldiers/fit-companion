/**
 * Server-computed league points from verified sessions (never from client).
 */
import { adminDbLoose } from "@/lib/db-admin";

function weekStartMonday(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(d.getDate() - day);
  return monday.toISOString().slice(0, 10);
}

export async function computeWeeklyLeaguePoints(userId: string): Promise<number> {
  const db = await adminDbLoose();
  if (!db) return 0;
  const weekStart = weekStartMonday();
  const { data: sessions } = await db
    .from("sessions")
    .select("date, duration_min, volume_kg, payload")
    .eq("user_id", userId)
    .gte("date", weekStart);
  let points = 0;
  for (const s of (sessions ?? []) as Array<{
    volume_kg?: number | null;
    payload?: Record<string, unknown> | null;
  }>) {
    const payload = (s.payload ?? {}) as Record<string, unknown>;
    const express = Boolean(payload["express"]);
    points += express ? 10 : 15;
    if (Number(s.volume_kg ?? 0) > 0) {
      points += Math.min(5, Math.floor(Number(s.volume_kg) / 5000));
    }
  }
  return points;
}
