import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Credenciales de Supabase no encontradas. Asegurar que esten definidas en el archivo .env");
}

const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            storage: isServer ? undefined : AsyncStorage,
            autoRefreshToken: !isServer,
            persistSession: !isServer,
            detectSessionInUrl: false,
        },
    }
);

