import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/context/auth-context';
import {
    getActiveCategories,
    getUserPreferences,
    saveUserPreferences,
} from '@/features/preferences/services/preferences.service';
import type { Category, UserPreferencesWithCategories } from '@/features/preferences/interfaces/preferences.interface';

type PreferencesContextType = {
    categories: Category[];
    selectedIds: string[];
    gastoMin: string;
    gastoMax: string;
    loading: boolean;
    hasPreferences: boolean;
    userPreferences: UserPreferencesWithCategories | null;
    toggleCategory: (id: string) => void;
    setGastoMin: (value: string) => void;
    setGastoMax: (value: string) => void;
    loadCategories: () => Promise<void>;
    checkPreferences: () => Promise<void>;
    savePreferences: () => Promise<boolean>;
};

const PreferencesContext = createContext<PreferencesContextType>({
    categories: [],
    selectedIds: [],
    gastoMin: '',
    gastoMax: '',
    loading: true,
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
    const [hasPreferences, setHasPreferences] = useState(false);
    const [userPreferences, setUserPreferences] = useState<UserPreferencesWithCategories | null>(null);

    const loadCategories = useCallback(async () => {
        const { data, error } = await getActiveCategories();
        if (!error && data) {
            setCategories(data);
        }
    }, []);

    const checkPreferences = useCallback(async () => {
        if (!user) {
            setHasPreferences(false);
            setUserPreferences(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data } = await getUserPreferences(user.id);
        setUserPreferences(data);
        setHasPreferences(!!data);
        setLoading(false);
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

    const savePreferences = useCallback(async () => {
        if (!user) return false;

        setLoading(true);
        const { error } = await saveUserPreferences({
            userId: user.id,
            movilidadPreferida: null,
            gastoMin: gastoMin ? Number(gastoMin) : null,
            gastoMax: gastoMax ? Number(gastoMax) : null,
            categoryIds: selectedIds,
        });
        setLoading(false);

        if (!error) {
            setHasPreferences(true);
            return true;
        }

        return false;
    }, [user, gastoMin, gastoMax, selectedIds]);

    return (
        <PreferencesContext.Provider
            value={{
                categories,
                selectedIds,
                gastoMin,
                gastoMax,
                loading,
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
