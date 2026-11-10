/**
 * Hooks de mutación del panel de intendencia (Fase 1 · APF3).
 *
 * Encapsulan el estado de carga/error de las operaciones de escritura para que
 * la pantalla solo se preocupe por pintar. No lanzan excepciones: devuelven
 * `{ success, error }` igual que los servicios.
 */

import { useCallback, useState } from 'react';

import type {
  AdminAnonymizeUserResult,
  AdminUpdateUserInput,
  AdminUpdateUserResult,
} from '../interfaces/admin.interface';
import { anonymizeAdminUser, updateAdminUser } from '../services/admin.service';

export interface UseAdminUserMutationsResult {
  saving: boolean;
  lastError: string | null;
  updateUser: (input: AdminUpdateUserInput) => Promise<AdminUpdateUserResult>;
  anonymizeUser: (userId: string) => Promise<AdminAnonymizeUserResult>;
  clearError: () => void;
}

export function useAdminUserMutations(): UseAdminUserMutationsResult {
  const [saving, setSaving] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const updateUser = useCallback(
    async (input: AdminUpdateUserInput): Promise<AdminUpdateUserResult> => {
      setSaving(true);
      setLastError(null);

      const result = await updateAdminUser(input);

      setSaving(false);
      if (!result.success) {
        setLastError(result.error ?? 'No fue posible actualizar el usuario.');
      }
      return result;
    },
    [],
  );

  const anonymizeUser = useCallback(
    async (userId: string): Promise<AdminAnonymizeUserResult> => {
      setSaving(true);
      setLastError(null);

      const result = await anonymizeAdminUser(userId);

      setSaving(false);
      if (!result.success) {
        setLastError(result.error ?? 'No fue posible dar de baja al usuario.');
      }
      return result;
    },
    [],
  );

  const clearError = useCallback(() => setLastError(null), []);

  return { saving, lastError, updateUser, anonymizeUser, clearError };
}
