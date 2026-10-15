/** Hooks de la feature Auth (Serie AX). */
export { useOtpCooldown, OTP_COOLDOWN_SECONDS, tickCooldown } from './use-otp-cooldown';
export {
  useOtpVerification,
  otpErrorMessage,
  OTP_FEEDBACK_MESSAGES,
} from './use-otp-verification';
export type {
  OtpMode,
  OtpPhase,
  OtpErrorKind,
  OtpFailureOutcome,
  OtpVerifyOutcome,
  OtpResendOutcome,
  UseOtpVerificationResult,
} from './use-otp-verification';
export { useRecoveryHandler, recoveryErrorMessage, resolveRecoveryScreenPatch } from './use-recovery-handler';
export type {
  RecoveryErrorKind,
  RecoveryHandlingOutcome,
  RecoveryScreenPatch,
  UseRecoveryHandlerResult,
} from './use-recovery-handler';
export { useLogin, runLogin, LOGIN_UNEXPECTED_ERROR } from './use-login';
export type { LoginFieldTarget, LoginOutcome, RunLoginOptions, UseLoginResult } from './use-login';
