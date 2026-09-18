import { supabase } from "@/integrations/supabase/client";
import { ensureSocialProfile } from "@/lib/social";
import { socialWriteFn } from "@/lib/social-write.functions";
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

/**
 * Link Supabase Auth to app user + social profile.
 * @param appUserId — public.users.id (not auth uuid)
 * @param authUserId — auth.users.id
 */
export async function linkAuthToSocial(
  deviceId: string,
  displayName: string,
  appUserId: string,
  authUserId?: string,
) {
  await ensureSocialProfile(deviceId, displayName);
  if (authUserId && appUserId) {
    await socialWriteFn({
      data: {
        op: "linkAuthSocial",
        deviceId,
        displayName,
        appUserId,
        authUserId,
      },
    });
    return;
  }
  await socialWriteFn({
    data: { op: "ensureProfile", deviceId, displayName },
  });
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
