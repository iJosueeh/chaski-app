import { useCallback, useState } from 'react';

import { sanitizeAdminError } from '@/shared/utils/sanitize-admin-error';

import { signIn } from '../services/auth.service';
import { validateLoginFields } from '../utils/password-validation';

export type LoginFieldTarget = 'email' | 'password';

export type LoginOutcome =
  | { status: 'success' }
  | { status: 'ignored' }
  | {
      status: 'error';
      kind: 'validation';
      emailError?: string;
      passwordError?: string;
      field: LoginFieldTarget;
    }
  | { status: 'error'; kind: 'server'; message: string; field: LoginFieldTarget };

export const LOGIN_UNEXPECTED_ERROR = 'Ocurrió un error al iniciar sesión';

export interface RunLoginOptions {
  email: string;
  password: string;
  busy: boolean;
  onStarting?: () => void;
  setIsPasswordRecovery: (isRecovery: boolean) => void;
  setIsRecoveryVerified: (isVerified: boolean) => void;
  signIn?: (credentials: { email: string; password: string }) => Promise<{ error: any }>;
}

export async function runLogin(options: RunLoginOptions): Promise<LoginOutcome> {
  const {
    email,
    password,
    busy,
    onStarting,
    setIsPasswordRecovery,
    setIsRecoveryVerified,
    signIn: signInFn = signIn,
  } = options;

  if (busy) return { status: 'ignored' };

  const validation = validateLoginFields(email, password);
  if (!validation.isValid) {
    return {
      status: 'error',
      kind: 'validation',
      emailError: validation.emailError,
      passwordError: validation.passwordError,
      field: validation.emailError ? 'email' : 'password',
    };
  }

  onStarting?.();
  setIsPasswordRecovery(false);
  setIsRecoveryVerified(false);

  try {
    const { error } = await signInFn({
      email: validation.normalizedEmail!,
      password,
    });

    if (error) {
      return {
        status: 'error',
        kind: 'server',
        message: sanitizeAdminError(error),
        field: 'password',
      };
    }

    return { status: 'success' };
  } catch (err: any) {
    return {
      status: 'error',
      kind: 'server',
      message: err ? sanitizeAdminError(err) : LOGIN_UNEXPECTED_ERROR,
      field: 'password',
    };
  }
}

export interface UseLoginResult {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  error: string;
  emailError: string;
  passwordError: string;
  changeEmail: (value: string) => void;
  changePassword: (value: string) => void;
  toggleShowPassword: () => void;
  submit: () => Promise<LoginFieldTarget | null>;
}

export function useLogin(options: Pick<RunLoginOptions, 'setIsPasswordRecovery' | 'setIsRecoveryVerified'>): UseLoginResult {
  const { setIsPasswordRecovery, setIsRecoveryVerified } = options;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  const changeEmail = useCallback(
    (value: string) => {
      setEmail(value);
      if (error) setError('');
      if (emailError) setEmailError('');
    },
    [error, emailError],
  );

  const changePassword = useCallback(
    (value: string) => {
      setPassword(value);
      if (error) setError('');
      if (passwordError) setPasswordError('');
    },
    [error, passwordError],
  );

  const toggleShowPassword = useCallback(() => setShowPassword((prev) => !prev), []);

  const submit = useCallback(async (): Promise<LoginFieldTarget | null> => {
    const outcome = await runLogin({
      email,
      password,
      busy: loading,
      onStarting: () => {
        setLoading(true);
        setError('');
        setEmailError('');
        setPasswordError('');
      },
      setIsPasswordRecovery,
      setIsRecoveryVerified,
    });

    if (outcome.status === 'ignored') return null;

    if (outcome.status === 'error') {
      if (outcome.kind === 'validation') {
        setEmailError(outcome.emailError ?? '');
        setPasswordError(outcome.passwordError ?? '');
      } else {
        setError(outcome.message);
      }
      setLoading(false);
      return outcome.field;
    }

    setLoading(false);
    return null;
  }, [email, password, loading, setIsPasswordRecovery, setIsRecoveryVerified]);

  return {
    email,
    password,
    showPassword,
    loading,
    error,
    emailError,
    passwordError,
    changeEmail,
    changePassword,
    toggleShowPassword,
    submit,
  };
}
