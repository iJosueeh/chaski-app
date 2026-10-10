import * as Linking from "expo-linking";
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

export async function updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
    });

    return { data, error };
}

/**
 * Genera la URL de retorno para el enlace de recuperación de contraseña.
 * Adapta dinámicamente el scheme según el entorno (ej. 'chaski://reset-password' en nativo o 'exp://...' en Expo Go).
 */
export function getResetPasswordRedirectUrl(): string {
    return Linking.createURL('/reset-password');
}

/**
 * Solicita el envío de un correo de recuperación de contraseña mediante Supabase Auth.
 */
export async function requestPasswordReset(email: string, redirectTo?: string) {
    const targetUrl = redirectTo ?? getResetPasswordRedirectUrl();
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: targetUrl,
    });

    return { data, error };
}
