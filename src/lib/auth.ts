import { supabase } from "@/integrations/supabase/client";
import { ensureSocialProfile } from "@/lib/social";
import { notifySocial } from "@/lib/notifications";

/** Magic-link auth. Links social_profiles.user_id when possible. */
export async function signInWithMagicLink(email: string) {
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/perfil` : undefined;
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/perfil` : undefined;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    ...(redirectTo ? { options: { redirectTo } } : {}),
  });
  if (error) throw error;
}

export async function signOutAuth() {
  await supabase.auth.signOut();
}

export async function getAuthUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function linkAuthToSocial(deviceId: string, displayName: string, userId: string) {
  await ensureSocialProfile(deviceId, displayName);
  await supabase
    .from("social_profiles")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq("device_id", deviceId);
}

/** Subscribe to auth and optionally fire a welcome local notification. */
export function watchAuth(onUser: (userId: string | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    onUser(session?.user?.id ?? null);
    if (event === "SIGNED_IN") {
      notifySocial("Soldiers Training", "Conta vinculada — seu progresso fica seguro.", "soldiers-auth");
    }
  });
  return () => data.subscription.unsubscribe();
}
