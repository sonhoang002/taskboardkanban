import { getSupabase } from "./supabase";

let pending: Promise<string> | null = null;

async function createOrReuseSession(): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (data.session) {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      throw new Error(
        "Unable to verify your guest session. Check your connection and try again.",
      );
    }

    return userData.user.id;
  }

  const { data: signInData, error: signInError } =
    await supabase.auth.signInAnonymously();

  if (signInError) {
    throw new Error(signInError.message);
  }

  if (!signInData.user) {
    throw new Error("Failed to create guest session.");
  }

  return signInData.user.id;
}

export function ensureGuestSession(): Promise<string> {
  pending ??= createOrReuseSession().finally(() => {
    pending = null;
  });

  return pending;
}
