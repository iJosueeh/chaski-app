import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/context/auth-context';
import {
    getActiveCategories,
    getUserPreferences,
    saveUserPreferencesAtomic,
} from '@/features/preferences/services/preferences.service';
import type { Category, UserPreferencesWithCategories } from '@/features/preferences/interfaces/preferences.interface';

type PreferencesContextType = {
    categories: Category[];
    selectedIds: string[];
    gastoMin: string;
    gastoMax: string;
    loading: boolean;
    initialLoading: boolean;
    hasPreferences: boolean;
    userPreferences: UserPreferencesWithCategories | null;
    toggleCategory: (id: string) => void;
    setGastoMin: (value: string) => void;
    setGastoMax: (value: string) => void;
    loadCategories: () => Promise<void>;
    checkPreferences: (options?: { isBackground?: boolean }) => Promise<void>;
    savePreferences: (overrideData?: {
        categoryIds?: string[];
        gastoMin?: string;
        gastoMax?: string;
    }) => Promise<boolean>;
};

const PreferencesContext = createContext<PreferencesContextType>({
    categories: [],
    selectedIds: [],
    gastoMin: '',
    gastoMax: '',
    loading: false,
    initialLoading: true,
    hasPreferences: false,
    userPreferences: null,
    toggleCategory: () => {},
    setGastoMin: () => {},
    setGastoMax: () => {},
    loadCategories: async () => {},
    checkPreferences: async () => {},
    savePreferences: async () => false,
});

export function usePreferences() {
    return useContext(PreferencesContext);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [gastoMin, setGastoMin] = useState('');
    const [gastoMax, setGastoMax] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [hasPreferences, setHasPreferences] = useState(false);
    const [userPreferences, setUserPreferences] = useState<UserPreferencesWithCategories | null>(null);

    // Protección frente a respuestas asíncronas tardías de sesiones anteriores (H-04)
    // y descarte de respuestas desfasadas del mismo usuario
    const activeUserIdRef = useRef<string | null>(user?.id ?? null);
    const actionSeqRef = useRef<number>(0);
    const initialCheckDoneRef = useRef<boolean>(false);

    useEffect(() => {
        activeUserIdRef.current = user?.id ?? null;
        actionSeqRef.current += 1;
        if (!user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHasPreferences(false);
            setUserPreferences(null);
            setSelectedIds([]);
            setGastoMin('');
            setGastoMax('');
            setInitialLoading(false);
            initialCheckDoneRef.current = false;
        } else {
            if (!initialCheckDoneRef.current) {
                setInitialLoading(true);
            }
        }
    }, [user]);

    const loadCategories = useCallback(async () => {
        const { data, error } = await getActiveCategories();
        if (!error && data) {
            setCategories(data);
        }
    }, []);

    const checkPreferences = useCallback(async (options?: { isBackground?: boolean }) => {
        const isBackground = options?.isBackground ?? false;
        const requestUserId = user?.id ?? null;

        if (!requestUserId) {
            setHasPreferences(false);
            setUserPreferences(null);
            setLoading(false);
            setInitialLoading(false);
            return;
        }

        const currentSeq = ++actionSeqRef.current;
        if (!isBackground) {
            setLoading(true);
        }

        try {
            const { data, error } = await getUserPreferences(requestUserId);

            // Si el usuario cambió de sesión o se inició una acción más reciente, descartar
            if (activeUserIdRef.current !== requestUserId || currentSeq < actionSeqRef.current) {
                return;
            }

            if (!error && data) {
                setUserPreferences(data);
                setHasPreferences(true);
            } else if (!error && !data) {
                // Usuario sin preferencias registradas
                setUserPreferences(null);
                setHasPreferences(false);
            }
        } finally {
            if (activeUserIdRef.current === requestUserId && currentSeq >= actionSeqRef.current) {
                if (!isBackground) {
                    setLoading(false);
                }
                setInitialLoading(false);
                initialCheckDoneRef.current = true;
            }
        }
    }, [user]);

    useEffect(() => {
        if (!authLoading) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            checkPreferences();
        }
    }, [authLoading, checkPreferences]);

    const toggleCategory = useCallback((id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    }, []);

    const savePreferences = useCallback(async (overrideData?: {
        categoryIds?: string[];
        gastoMin?: string;
        gastoMax?: string;
    }) => {
        const currentUserId = user?.id ?? null;
        if (!currentUserId) return false;

        const effectiveIds = overrideData?.categoryIds ?? selectedIds;
        const effectiveMin = overrideData?.gastoMin !== undefined ? overrideData.gastoMin : gastoMin;
        const effectiveMax = overrideData?.gastoMax !== undefined ? overrideData.gastoMax : gastoMax;

        const parsedMin = effectiveMin.trim() ? Number(effectiveMin.trim()) : null;
        const parsedMax = effectiveMax.trim() ? Number(effectiveMax.trim()) : null;

        const currentSeq = ++actionSeqRef.current;
        setLoading(true);
        const { error } = await saveUserPreferencesAtomic({
            categoryIds: effectiveIds,
            gastoMin: parsedMin,
            gastoMax: parsedMax,
            actualizarMovilidad: false,
        });
        setLoading(false);

        // Si la sesión cambió durante la llamada RPC o se inició una acción más reciente, descartar
        if (activeUserIdRef.current !== currentUserId || currentSeq < actionSeqRef.current) {
            return false;
        }

        if (error) {
            return false;
        }

        // 1. Guardado confirmado por la RPC: marcar inmediatamente hasPreferences = true
        setHasPreferences(true);
        if (overrideData?.categoryIds) setSelectedIds(overrideData.categoryIds);
        if (overrideData?.gastoMin !== undefined) setGastoMin(overrideData.gastoMin);
        if (overrideData?.gastoMax !== undefined) setGastoMax(overrideData.gastoMax);

        // 2. Construir actualización coherente de userPreferences usando los datos confirmados
        // y preservando campos no editados (movilidad_preferida)
        setUserPreferences(prev => {
            const preservedMovilidad = prev?.movilidad_preferida ?? null;
            const updatedCategories: Category[] = effectiveIds.map(id => {
                const existing = categories.find(c => c.id === id) ?? prev?.categorias.find(c => c.id === id);
                return existing ?? { id, nombre: '', descripcion: null, estado: true };
            });

            return {
                usuario_id: currentUserId,
                movilidad_preferida: preservedMovilidad,
                gasto_min: parsedMin,
                gasto_max: parsedMax,
                categorias: updatedCategories,
            };
        });

        // 3. Re-consultar en segundo plano para sincronizar auditoría completa sin invalidar el éxito (H-01)
        try {
            await checkPreferences({ isBackground: true });
        } catch {
            // Un fallo de red en la re-lectura no anula que la RPC confirmó el guardado
        }

        return true;
    }, [user, gastoMin, gastoMax, selectedIds, categories, checkPreferences]);

    return (
        <PreferencesContext.Provider
            value={{
                categories,
                selectedIds,
                gastoMin,
                gastoMax,
                loading,
                initialLoading,
                hasPreferences,
                userPreferences,
                toggleCategory,
                setGastoMin,
                setGastoMax,
                loadCategories,
                checkPreferences,
                savePreferences,
            }}
        >
            {children}
        </PreferencesContext.Provider>
    );
}
