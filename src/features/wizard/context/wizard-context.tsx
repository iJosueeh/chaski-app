/**
 * WizardContext — estado del wizard de creación de plan (5 pasos).
 * Ubicación → Tiempo → Presupuesto → Intereses → Movilidad.
 *
 * Persiste en memoria (una sesión de wizard es efímera por diseño: si el
 * usuario cancela, no queda rastro). Al completar el paso 5 se construye la
 * "solicitud de plan" que el motor de planes consumirá.
 */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type WizardUbicacion = {
  modo: 'gps' | 'busqueda';
  nombre: string;
  lat: number | null;
  lng: number | null;
};

export type WizardPlanRequest = {
  ubicacion: WizardUbicacion | null;
  minutosTotales: number | null;
  horaInicio: string | null; // "HH:MM"
  horaFin: string | null; // "HH:MM"
  presupuesto: number | null;
  intereses: string[];
  movilidad: 'caminando' | 'publico' | 'aplicativo' | null;
};

const EMPTY_REQUEST: WizardPlanRequest = {
  ubicacion: null,
  minutosTotales: null,
  horaInicio: null,
  horaFin: null,
  presupuesto: null,
  intereses: [],
  movilidad: null,
};

interface WizardContextValue {
  request: WizardPlanRequest;
  isComplete: boolean;
  setUbicacion: (u: WizardUbicacion) => void;
  setTiempo: (v: { minutos: number; horaInicio: string; horaFin: string }) => void;
  setPresupuesto: (v: number) => void;
  setIntereses: (v: string[]) => void;
  setMovilidad: (v: WizardPlanRequest['movilidad'] | undefined) => void;
  reset: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<WizardPlanRequest>(EMPTY_REQUEST);

  const value = useMemo<WizardContextValue>(
    () => ({
      request,
      isComplete: Boolean(
        request.ubicacion &&
          request.minutosTotales &&
          request.horaInicio &&
          request.horaFin &&
          request.presupuesto != null &&
          request.movilidad,
      ),
      setUbicacion: (u) =>
        setRequest((prev) => ({ ...prev, ubicacion: u })),
      setTiempo: ({ minutos, horaInicio, horaFin }) =>
        setRequest((prev) => ({
          ...prev,
          minutosTotales: minutos,
          horaInicio,
          horaFin,
        })),
      setPresupuesto: (v) => setRequest((prev) => ({ ...prev, presupuesto: v })),
      setIntereses: (v) => setRequest((prev) => ({ ...prev, intereses: v })),
      setMovilidad: (v) => setRequest((prev) => ({ ...prev, movilidad: v ?? null })),
      reset: () => setRequest(EMPTY_REQUEST),
    }),
    [request],
  );

  return (
    <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error('useWizard debe usarse dentro de <WizardProvider>');
  }
  return ctx;
}
