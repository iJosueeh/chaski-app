import { useState, useCallback } from 'react';
import type { AdminSetStatusResult } from '../interfaces/admin.interface';
import { changeUserAccountStatus } from '../services/admin.service';

export function useAdminStatusManager() {
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AdminSetStatusResult | null>(null);

  const setUserStatus = useCallback(
    async (targetUserId: string, newStatus: boolean): Promise<AdminSetStatusResult> => {
      setUpdatingUserId(targetUserId);
      setError(null);

      const result = await changeUserAccountStatus(targetUserId, newStatus);

      setUpdatingUserId(null);
      setLastResult(result);

      if (!result.success && result.error) {
        setError(result.error);
      }

      return result;
    },
    []
  );

  const clearStatusError = useCallback(() => {
    setError(null);
  }, []);

  return {
    updatingUserId,
    isUpdating: Boolean(updatingUserId),
    error,
    lastResult,
    setUserStatus,
    clearStatusError,
  };
}
