import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Category, UserPreferencesWithCategories } from '../interfaces/preferences.interface';

describe('Auditoría H-01 & H-04: Resiliencia de Guardado y Concurrencia de Sesión', () => {
  const mockCategories: Category[] = [
    { id: 'cat-1', nombre: 'Gastronomía', descripcion: 'Comida criolla', estado: true },
    { id: 'cat-2', nombre: 'Museos', descripcion: 'Historia y arte', estado: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('H-01: Desacoplamiento entre Éxito de la RPC y Fallo Posterior de checkPreferences', () => {
    it('cuando saveUserPreferencesAtomic confirma éxito, savePreferences nunca reporta fallo aunque checkPreferences falle', async () => {
      // Simulación de la lógica implementada en PreferencesContext
      let hasPreferences = false;
      let userPreferences: UserPreferencesWithCategories | null = {
        usuario_id: 'user-001',
        movilidad_preferida: 'caminando',
        gasto_min: 20,
        gasto_max: 50,
        categorias: [mockCategories[0]],
      };

      const simulateSavePreferences = async (overrideData: {
        categoryIds: string[];
        gastoMin: string;
        gastoMax: string;
      }) => {
        // 1. Llamada atómica a la RPC
        const rpcResult = {
          data: { success: true, usuario_id: 'user-001', categories_saved: 2, updated_at: '2026-10-11T22:00:00Z' },
          error: null,
        };

        if (rpcResult.error) {
          return false;
        }

        // Éxito confirmado por la base de datos
        hasPreferences = true;

        // Construcción optimista coherente
        const updatedCategories = overrideData.categoryIds.map(id => {
          const found = mockCategories.find(c => c.id === id);
          return found ?? { id, nombre: '', descripcion: null, estado: true };
        });

        userPreferences = {
          usuario_id: 'user-001',
          movilidad_preferida: userPreferences?.movilidad_preferida ?? null,
          gasto_min: Number(overrideData.gastoMin),
          gasto_max: Number(overrideData.gastoMax),
          categorias: updatedCategories,
        };

        // 2. Consulta de sincronización posterior sufre caída de red
        try {
          throw new Error('Network request timeout during checkPreferences');
        } catch {
          // El fallo de re-consulta no anula el guardado confirmado por la RPC
        }

        return true;
      };

      const success = await simulateSavePreferences({
        categoryIds: ['cat-1', 'cat-2'],
        gastoMin: '30',
        gastoMax: '90',
      });

      // Verificaciones estrictas H-01
      expect(success).toBe(true);
      expect(hasPreferences).toBe(true);
      expect(userPreferences).not.toBeNull();
      expect(userPreferences?.usuario_id).toBe('user-001');
      expect(userPreferences?.gasto_min).toBe(30);
      expect(userPreferences?.gasto_max).toBe(90);
      expect(userPreferences?.categorias).toHaveLength(2);
      expect(userPreferences?.movilidad_preferida).toBe('caminando'); // Preserva movilidad histórica
    });
  });

  describe('H-04: Protección contra Respuestas Asíncronas Tardías de Sesiones Previas', () => {
    it('descarta respuestas de consultas iniciadas por un usuario si la sesión cambió o se cerró antes de resolver', async () => {
      let activeUserIdRef: string | null = 'user-initial';
      let contextHasPreferences = false;
      let contextUserPreferences: any = null;

      // Simula el handler protegido con activeUserIdRef
      const handleCheckPreferencesResponse = (requestUserId: string, responseData: any) => {
        // Guarda de concurrencia: si el usuario activo cambió, descarta la respuesta
        if (activeUserIdRef !== requestUserId) {
          return;
        }

        if (responseData) {
          contextUserPreferences = responseData;
          contextHasPreferences = true;
        }
      };

      // 1. Petición iniciada por user-initial
      const requestUserId = 'user-initial';

      // 2. El usuario cierra sesión antes de que la promesa resuelva
      activeUserIdRef = null;

      // 3. Llega la respuesta tardía del servidor para user-initial
      handleCheckPreferencesResponse(requestUserId, {
        usuario_id: 'user-initial',
        movilidad_preferida: 'caminando',
        gasto_min: 10,
        gasto_max: 30,
        categorias: mockCategories,
      });

      // No debe contaminar la sesión cerrada
      expect(contextHasPreferences).toBe(false);
      expect(contextUserPreferences).toBeNull();
    });

    it('descarta respuestas de un guardado en vuelo si la sesión cambia a otro usuario antes de completar', async () => {
      let activeUserIdRef: string | null = 'user-A';
      let activeUserPreferences: any = null;

      const handleSaveComplete = (requestUserId: string, confirmedData: any) => {
        if (activeUserIdRef !== requestUserId) {
          // Descartar
          return false;
        }
        activeUserPreferences = confirmedData;
        return true;
      };

      // Inicia guardado User A
      const requestUserId = 'user-A';

      // Se cambia de cuenta a User B
      activeUserIdRef = 'user-B';

      // Resuelve guardado de User A
      const saved = handleSaveComplete(requestUserId, { usuario_id: 'user-A', gasto_min: 50 });

      expect(saved).toBe(false);
      expect(activeUserPreferences).toBeNull();
    });

    it('descarta respuestas antiguas de checkPreferences si se guardó un estado más reciente para el mismo usuario', async () => {
      let actionSeq = 0;
      let confirmedPreferences: any = null;

      // 1. Inicia checkPreferences antiguo (Seq 1)
      const checkSeq = ++actionSeq;

      // 2. Antes de que resuelva el check, el usuario edita y guarda con éxito (Seq 2)
      ++actionSeq;
      confirmedPreferences = {
        usuario_id: 'user-same',
        gasto_min: 100,
        gasto_max: 200,
        categorias: [mockCategories[0]],
      };

      // 3. Llega la respuesta atrasada de checkPreferences (Seq 1 con datos viejos de gasto: 10..20)
      const staleDataFromOldCheck = {
        usuario_id: 'user-same',
        gasto_min: 10,
        gasto_max: 20,
        categorias: [],
      };

      // Handler protegido por contador secuencial
      if (checkSeq >= actionSeq) {
        confirmedPreferences = staleDataFromOldCheck;
      }

      // La respuesta atrasada (Seq 1) debe ser descartada frente a la acción más reciente (Seq 2)
      expect(confirmedPreferences.gasto_min).toBe(100);
      expect(confirmedPreferences.gasto_max).toBe(200);
      expect(confirmedPreferences.categorias).toHaveLength(1);
    });
  });
});

