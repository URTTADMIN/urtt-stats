import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function createMissingSupabaseClient() {
  const emptyResult = { data: [], error: null };
  const singleResult = { data: null, error: null };
  const query = {
    select: () => query,
    order: () => query,
    range: () => query,
    gte: () => query,
    eq: () => query,
    delete: () => query,
    update: () => query,
    insert: () => query,
    upsert: () => query,
    single: () => Promise.resolve(singleResult),
    then: (resolve, reject) => Promise.resolve(emptyResult).then(resolve, reject),
  };
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: null, error: { message: "Supabase n'est pas configuré en local." } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => query,
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: { message: "Supabase Storage n'est pas configuré en local." } }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  };
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMissingSupabaseClient();
