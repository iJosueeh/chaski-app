/**
 * Servicio de lectura del registro de perfil del usuario autenticado.
 *
 * `fetchUserProfileRecord` consulta el rol, estado y datos institucionales del
 * usuario desde `public.usuarios`; lo consume AuthContext para derivar
 * `userProfile`, `userRole` y `accountStatus` durante la sincronización de
 * sesión. Su contrato es idéntico al histórico (vivía en
 * `admin/services/admin.service.ts`); se traslada aquí porque la consulta
 * pertenece al dominio de sesión/perfil, no al de administración.
 *
 * Si la tabla o fila no existe (ej. usuario nuevo antes de sincronización),
 * maneja el error de forma segura sin romper la sesión.
 */

import { supabase } from '@/lib/supabase';
import { sanitizeAdminError } from '@/shared/utils/sanitize-admin-error';

import type { UserProfileRecord } from '../interfaces/auth.interfaces';

/**
 * Consulta el perfil institucional, rol y estado de un usuario desde public.usuarios.
 */
export async function fetchUserProfileRecord(userId: string): Promise<{
  data: UserProfileRecord | null;
  error?: string;
  isNetworkError?: boolean;
}> {
  if (!userId) {
    return { data: null, error: 'Identificador de usuario no proporcionado' };
  }

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, rol, estado, fecha_registro')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      const isNet = error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch');
      return {
        data: null,
        error: sanitizeAdminError(error),
        isNetworkError: isNet,
      };
    }

    if (!data) {
      return { data: null };
    }

    return {
      data: {
        id: data.id,
        nombre: data.nombre,
        rol: (data.rol === 'ADMIN' ? 'ADMIN' : 'USUARIO'),
        estado: Boolean(data.estado),
        fecha_registro: data.fecha_registro,
      },
    };
  } catch (err: any) {
    const isNet = err?.message?.includes('Network request failed') || err?.message?.includes('Failed to fetch');
    return {
      data: null,
      error: sanitizeAdminError(err),
      isNetworkError: isNet,
    };
  }
}
