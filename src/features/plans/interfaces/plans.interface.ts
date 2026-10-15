/**
 * Tipos del ciclo de vida del plan (Serie AX).
 *
 * El contexto (`plans-context.tsx`) re-exporta estos tipos para no romper a
 * los consumidores existentes; viven aquí para que el servicio de
 * persistencia no dependa del contexto (evita ciclos de importación).
 */
import type { GeneratedPlan } from '@/features/plan-engine/plan-engine';

export type EstadoExpedicion = 'COMPLETADA' | 'PARCIAL' | 'ABANDONADA';

export type PlanHistorialEntry = GeneratedPlan & {
  completado_en: string; // ISO date
  /** Órdenes de parada que el usuario marcó efectivamente como visitadas (p. ej. [1], [1, 2], []). */
  paradas_visitadas?: number[];
  /** IDs de los lugares de las paradas visitadas para robustez ante reordenamientos */
  paradas_visitadas_ids?: string[];
  /** Estado de la expedición calculado honestamente según su progreso real */
  estado_expedicion?: EstadoExpedicion;
};
