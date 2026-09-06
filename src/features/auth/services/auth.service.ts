import { supabase } from "@/lib/supabase";
import type { AuthRequest, LoginRequest } from "../interfaces/auth.interfaces";

export async function signUp({ nombre, email, password }: AuthRequest) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                nombre,
            },
        },
    });

    return { data, error };
}

export async function signIn({ email, password }: LoginRequest) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    return { data, error };
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();

    return { error };
}
