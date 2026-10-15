import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AdminUser,
  AdminUsersFilter,
  UserRole,
} from '../interfaces/admin.interface';
import { fetchAdminUsers } from '../services/admin.service';

export interface UseAdminUsersOptions extends AdminUsersFilter {
  autoFetch?: boolean;
}

export function useAdminUsers(options: UseAdminUsersOptions = {}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearchState] = useState<string>(options.search ?? '');
  const [limit, setLimitState] = useState<number>(options.limit ?? 20);
  const [offset, setOffsetState] = useState<number>(options.offset ?? 0);
  const [filtroRol, setFiltroRolState] = useState<UserRole | null>(options.filtroRol ?? null);
  const [filtroEstado, setFiltroEstadoState] = useState<boolean | null>(
    options.filtroEstado !== undefined ? options.filtroEstado : null
  );

  const requestIdRef = useRef<number>(0);
  const autoFetch = options.autoFetch !== false;

  const loadUsers = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const filter: AdminUsersFilter = {
      search,
      limit,
      offset,
      filtroRol,
      filtroEstado,
    };

    const result = await fetchAdminUsers(filter);

    // Evitar condiciones de carrera descartando respuestas obsoletas
    if (currentRequestId !== requestIdRef.current) {
      return;
    }

    if (result.error) {
      setError(result.error);
      setUsers([]);
      setTotalCount(0);
    } else if (result.data) {
      setUsers(result.data.users);
      setTotalCount(result.data.totalCount);
    }
    setLoading(false);
  }, [search, limit, offset, filtroRol, filtroEstado]);

  useEffect(() => {
    if (autoFetch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadUsers();
    }
  }, [loadUsers, autoFetch]);

  const setSearch = useCallback((newSearch: string) => {
    setSearchState(newSearch);
    setOffsetState(0);
  }, []);

  const setPage = useCallback(
    (pageIndex: number) => {
      const newOffset = Math.max(0, pageIndex) * limit;
      setOffsetState(newOffset);
    },
    [limit]
  );

  const setLimit = useCallback((newLimit: number) => {
    setLimitState(newLimit);
    setOffsetState(0);
  }, []);

  const setFiltroRol = useCallback((rol: UserRole | null) => {
    setFiltroRolState(rol);
    setOffsetState(0);
  }, []);

  const setFiltroEstado = useCallback((estado: boolean | null) => {
    setFiltroEstadoState(estado);
    setOffsetState(0);
  }, []);

  const currentPage = Math.floor(offset / (limit || 1));
  const totalPages = Math.ceil(totalCount / (limit || 1));
  const hasMore = offset + limit < totalCount;

  return {
    users,
    totalCount,
    loading,
    error,
    currentPage,
    totalPages,
    hasMore,
    search,
    limit,
    offset,
    filtroRol,
    filtroEstado,
    setSearch,
    setPage,
    setLimit,
    setFiltroRol,
    setFiltroEstado,
    refetch: loadUsers,
  };
}
