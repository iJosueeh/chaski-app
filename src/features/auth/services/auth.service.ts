import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import type { AuthRequest, LoginRequest } from "../interfaces/auth.interfaces";
import { validateEmail } from "../utils/password-validation";
import {
    normalizeEmail,
    validateOtpFormat,
    sanitizeAuthError,
} from "../utils/otp-validation";

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

export interface UpdateProfileRequest {
    nombre: string;
}

export async function updateProfile({ nombre }: UpdateProfileRequest) {
    const { data, error } = await supabase.auth.updateUser({
        data: {
            nombre,
        },
    });

    return { data, error };
}

export function getResetPasswordRedirectUrl(): string {
    return Linking.createURL('/reset-password');
}

export interface RequestPasswordResetOptions {
    redirectTo?: string | null;
}

export async function requestPasswordReset(
    email: string,
    optionsOrRedirectTo?: string | null | RequestPasswordResetOptions
) {
    const normalizedEmail = normalizeEmail(email);

    let targetUrl: string | undefined;

    if (typeof optionsOrRedirectTo === "string") {
        targetUrl = optionsOrRedirectTo;
    } else if (optionsOrRedirectTo === null) {
        targetUrl = undefined;
    } else if (typeof optionsOrRedirectTo === "object" && optionsOrRedirectTo !== null) {
        targetUrl = optionsOrRedirectTo.redirectTo === null ? undefined : (optionsOrRedirectTo.redirectTo ?? undefined);
    } else {
        targetUrl = getResetPasswordRedirectUrl();
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        targetUrl ? { redirectTo: targetUrl } : undefined
    );

    return { data, error };
}

export interface VerifyRecoveryOtpParams {
    email: string;
    token: string;
}

export async function verifyRecoveryOtp(
    emailOrParams: string | VerifyRecoveryOtpParams,
    tokenArg?: string
) {
    let email: string;
    let token: string;

    if (typeof emailOrParams === "object" && emailOrParams !== null) {
        email = emailOrParams.email;
        token = emailOrParams.token;
    } else {
        email = emailOrParams;
        token = tokenArg ?? "";
    }

    const normalizedEmail = normalizeEmail(email);
    const emailValidation = validateEmail(normalizedEmail);
    if (!emailValidation.isValid) {
        return {
            data: { user: null, session: null },
            error: {
                name: "ValidationError",
                message: emailValidation.error ?? "Ingresa un formato de correo válido",
            },
        };
    }

    const otpValidation = validateOtpFormat(token);
    if (!otpValidation.isValid) {
        return {
            data: { user: null, session: null },
            error: {
                name: "ValidationError",
                message: otpValidation.error ?? "El código de verificación debe contener 6 dígitos numéricos",
            },
        };
    }

    const sanitizedToken = token.trim();

    const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: sanitizedToken,
        type: "recovery",
    });

    if (error) {
        const sanitized = sanitizeAuthError(error);
        return {
            data,
            error: {
                ...error,
                message: sanitized.message,
            },
        };
    }

    return { data, error: null };
}

export interface VerifySignupOtpParams {
    email: string;
    token: string;
}

export async function verifySignupOtp(
    emailOrParams: string | VerifySignupOtpParams,
    tokenArg?: string
) {
    let email: string;
    let token: string;

    if (typeof emailOrParams === "object" && emailOrParams !== null) {
        email = emailOrParams.email;
        token = emailOrParams.token;
    } else {
        email = emailOrParams;
        token = tokenArg ?? "";
    }

    const normalizedEmail = normalizeEmail(email);
    const emailValidation = validateEmail(normalizedEmail);
    if (!emailValidation.isValid) {
        return {
            data: { user: null, session: null },
            error: {
                name: "ValidationError",
                message: emailValidation.error ?? "Ingresa un formato de correo válido",
            },
        };
    }

    const otpValidation = validateOtpFormat(token);
    if (!otpValidation.isValid) {
        return {
            data: { user: null, session: null },
            error: {
                name: "ValidationError",
                message: otpValidation.error ?? "El código de verificación debe contener 6 dígitos numéricos",
            },
        };
    }

    const sanitizedToken = token.trim();

    const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: sanitizedToken,
        type: "signup",
    });

    if (error) {
        const sanitized = sanitizeAuthError(error);
        return {
            data,
            error: {
                ...error,
                message: sanitized.message,
            },
        };
    }

    return { data, error: null };
}

export interface ResendSignupOtpParams {
    email: string;
}

export async function resendSignupOtp(emailOrParams: string | ResendSignupOtpParams) {
    let email: string;

    if (typeof emailOrParams === "object" && emailOrParams !== null) {
        email = emailOrParams.email;
    } else {
        email = emailOrParams;
    }

    const normalizedEmail = normalizeEmail(email);
    const emailValidation = validateEmail(normalizedEmail);
    if (!emailValidation.isValid) {
        return {
            data: { user: null, session: null },
            error: {
                name: "ValidationError",
                message: emailValidation.error ?? "Ingresa un formato de correo válido",
            },
        };
    }

    const { data, error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
    });

    if (error) {
        const sanitized = sanitizeAuthError(error);
        return {
            data,
            error: {
                ...error,
                message: sanitized.message,
            },
        };
    }

    return { data, error: null };
}
