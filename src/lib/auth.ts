import { supabase } from "@/integrations/supabase/client";
import { ensureSocialProfile } from "@/lib/social";
import { socialWriteFn } from "@/lib/social-write.functions";
import { notifySocial } from "@/lib/notifications";

export async function signUpWithEmail(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { display_name: name.trim().slice(0, 80) } },
  });
  if (error) throw error;
  return data;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function resetPassword(email: string) {
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/entrar` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    ...(redirectTo ? { redirectTo } : {}),
  });
  if (error) throw error;
}

/** Kept for compatibility — not used as an entry path. */
export async function signInWithMagicLink(email: string) {
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/perfil` : undefined;
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
  });
  if (error) throw error;
}

/** Kept for compatibility — not used as an entry path. */
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

export async function getAuthSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/**
 * Link Supabase Auth UUID to app user via server (session resolves userId).
 * @param authUserId — auth.users.id from Supabase Auth
 */
export async function linkAuthToSocial(deviceId: string, displayName: string, authUserId: string) {
  await ensureSocialProfile(deviceId, displayName);
  if (!authUserId) return;
  await socialWriteFn({
    data: {
      op: "linkAuthSocial",
      deviceId,
      displayName,
      authUserId,
    },
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
