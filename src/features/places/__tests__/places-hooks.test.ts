import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INITIAL_PLACE_STATE,
  isPlaceLoading,
  loadPlaceOutcome,
  placeReducer,
} from '../hooks/use-place';
import {
  INITIAL_PLACES_STATE,
  loadActivePlacesOutcome,
  placesReducer,
  type PlacesState,
} from '../hooks/use-places';
import type { Place } from '../interface/places.interface';
import * as placesService from '../services/places.service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('../services/places.service');

function makePlace(id: string, nombre: string): Place {
  return {
    id,
    nombre,
    descripcion: null,
    latitud: -12.111,
    longitud: -77.033,
    direccion: null,
    gasto_min: 15,
    gasto_max: 30,
    duracion_sugerida_min: 60,
    estado: true,
    fuente: 'dataset-osm-chaski',
    external_id: `test:${id}`,
    tipo_disponibilidad: 'HORARIO_REGISTRADO',
    fecha_actualizacion: '2026-10-14T00:00:00Z',
    categorias: [],
    etiquetas: [],
    horarios: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePlaces — lógica del catálogo (Serie AX)', () => {
  describe('loadActivePlacesOutcome (consulta real con servicio simulado)', () => {
    it('clasifica una carga exitosa', async () => {
      const places = [makePlace('lugar-1', 'Huaca Pucllana')];
      vi.spyOn(placesService, 'getActivePlaces').mockResolvedValue({ data: places, error: null });

      await expect(loadActivePlacesOutcome()).resolves.toEqual({
        places,
        errorKind: null,
      });
      expect(placesService.getActivePlaces).toHaveBeenCalledTimes(1);
    });

    it('devuelve lista vacía cuando el catálogo no tiene registros', async () => {
      vi.spyOn(placesService, 'getActivePlaces').mockResolvedValue({ data: [], error: null });

      await expect(loadActivePlacesOutcome()).resolves.toEqual({
        places: [],
        errorKind: null,
      });
    });

    it('trata «data null sin error» como lista vacía (defensa)', async () => {
      vi.spyOn(placesService, 'getActivePlaces').mockResolvedValue({
        data: null,
        error: null,
      } as never);

      await expect(loadActivePlacesOutcome()).resolves.toEqual({
        places: [],
        errorKind: null,
      });
    });

    it('clasifica el error del servicio como «service»', async () => {
      vi.spyOn(placesService, 'getActivePlaces').mockResolvedValue({
        data: null,
        error: { message: 'boom' },
      } as never);

      await expect(loadActivePlacesOutcome()).resolves.toEqual({
        places: null,
        errorKind: 'service',
      });
    });

    it('clasifica el rechazo de red como «network»', async () => {
      vi.spyOn(placesService, 'getActivePlaces').mockRejectedValue(new Error('sin red'));

      await expect(loadActivePlacesOutcome()).resolves.toEqual({
        places: null,
        errorKind: 'network',
      });
    });
  });

  describe('placesReducer (carga, refresco y reintento)', () => {
    const withList: PlacesState = {
      places: [makePlace('lugar-1', 'Huaca Pucllana')],
      loading: false,
      refreshing: false,
      errorKind: null,
    };

    it('arranca en carga inicial', () => {
      expect(INITIAL_PLACES_STATE).toEqual({
        places: [],
        loading: true,
        refreshing: false,
        errorKind: null,
      });
    });

    it('aplica la lista en una carga exitosa', () => {
      const next = placesReducer(INITIAL_PLACES_STATE, {
        type: 'loadSucceeded',
        places: withList.places,
      });

      expect(next).toEqual({
        places: withList.places,
        loading: false,
        refreshing: false,
        errorKind: null,
      });
    });

    it('limpia la lista y expone el kind de error en un fallo', () => {
      const next = placesReducer(withList, { type: 'loadFailed', errorKind: 'service' });

      expect(next).toEqual({
        places: [],
        loading: false,
        refreshing: false,
        errorKind: 'service',
      });
    });

    it('el refresco por gesto muestra el indicador sin ocultar la lista visible', () => {
      const next = placesReducer(withList, { type: 'loadStarted', mode: 'refresh' });

      expect(next.refreshing).toBe(true);
      expect(next.loading).toBe(false);
      expect(next.places).toEqual(withList.places);
    });

    it('el refresco fallido limpia la lista y deja el error (comportamiento vigente)', () => {
      const refreshing = placesReducer(withList, { type: 'loadStarted', mode: 'refresh' });
      const next = placesReducer(refreshing, { type: 'loadFailed', errorKind: 'network' });

      expect(next).toEqual({
        places: [],
        loading: false,
        refreshing: false,
        errorKind: 'network',
      });
    });

    it('el reintento vuelve a la carga y limpia el error sin tocar la lista', () => {
      const failed = placesReducer(withList, { type: 'loadFailed', errorKind: 'service' });
      const next = placesReducer(failed, { type: 'loadStarted', mode: 'reload' });

      expect(next.loading).toBe(true);
      expect(next.errorKind).toBeNull();
    });

    it('flujo completo de refresco: la última consulta gana', () => {
      const stale = [makePlace('lugar-1', 'Huaca Pucllana')];
      const fresh = [makePlace('lugar-1', 'Huaca Pucllana'), makePlace('lugar-2', 'Canta Rana')];

      let state = placesReducer(INITIAL_PLACES_STATE, { type: 'loadSucceeded', places: stale });
      state = placesReducer(state, { type: 'loadStarted', mode: 'refresh' });
      state = placesReducer(state, { type: 'loadSucceeded', places: fresh });

      expect(state.places).toEqual(fresh);
      expect(state.refreshing).toBe(false);
    });
  });
});

describe('usePlace — lógica de la ficha (Serie AX)', () => {
  describe('loadPlaceOutcome (consulta real con servicio simulado)', () => {
    it('clasifica una carga exitosa', async () => {
      const place = makePlace('lugar-1', 'Huaca Pucllana');
      vi.spyOn(placesService, 'getPlaceById').mockResolvedValue({ data: place, error: null });

      await expect(loadPlaceOutcome('lugar-1')).resolves.toEqual({
        requestedId: 'lugar-1',
        place,
        errorKind: null,
      });
      expect(placesService.getPlaceById).toHaveBeenCalledWith('lugar-1');
    });

    it('clasifica el error del servicio como «service»', async () => {
      vi.spyOn(placesService, 'getPlaceById').mockResolvedValue({
        data: null,
        error: { message: 'boom' },
      } as never);

      await expect(loadPlaceOutcome('lugar-1')).resolves.toEqual({
        requestedId: 'lugar-1',
        place: null,
        errorKind: 'service',
      });
    });

    it('clasifica la ausencia de destino activo como «notFound»', async () => {
      vi.spyOn(placesService, 'getPlaceById').mockResolvedValue({ data: null, error: null });

      await expect(loadPlaceOutcome('inexistente')).resolves.toEqual({
        requestedId: 'inexistente',
        place: null,
        errorKind: 'notFound',
      });
    });

    it('clasifica el rechazo de red como «network»', async () => {
      vi.spyOn(placesService, 'getPlaceById').mockRejectedValue(new Error('sin red'));

      await expect(loadPlaceOutcome('lugar-1')).resolves.toEqual({
        requestedId: 'lugar-1',
        place: null,
        errorKind: 'network',
      });
    });

    it('con id ausente clasifica «missingId» sin consultar el servicio', async () => {
      await expect(loadPlaceOutcome('')).resolves.toEqual({
        requestedId: '',
        place: null,
        errorKind: 'missingId',
      });
      expect(placesService.getPlaceById).not.toHaveBeenCalled();
    });
  });

  describe('placeReducer e isPlaceLoading (carga, cambio de id y reintento)', () => {
    const place = makePlace('lugar-1', 'Huaca Pucllana');

    it('sin resolver, el id pedido está en carga', () => {
      expect(isPlaceLoading('lugar-1', INITIAL_PLACE_STATE.resolvedId)).toBe(true);
    });

    it('resuelto el mismo id, no hay carga', () => {
      const state = placeReducer(INITIAL_PLACE_STATE, {
        type: 'loadSucceeded',
        requestedId: 'lugar-1',
        place,
      });

      expect(state.resolvedId).toBe('lugar-1');
      expect(isPlaceLoading('lugar-1', state.resolvedId)).toBe(false);
    });

    it('al cambiar de id en la ruta, la ficha resuelta queda en carga', () => {
      const previous = placeReducer(INITIAL_PLACE_STATE, {
        type: 'loadSucceeded',
        requestedId: 'lugar-1',
        place,
      });

      // resolvedId corresponde al id anterior: para «lugar-2» debe mostrar carga.
      expect(isPlaceLoading('lugar-2', previous.resolvedId)).toBe(true);
    });

    it('tras resolver el nuevo id, termina la carga del cambio de id', () => {
      const next = makePlace('lugar-2', 'Canta Rana');
      let state = placeReducer(INITIAL_PLACE_STATE, {
        type: 'loadSucceeded',
        requestedId: 'lugar-1',
        place,
      });
      state = placeReducer(state, { type: 'loadStarted' });
      state = placeReducer(state, { type: 'loadSucceeded', requestedId: 'lugar-2', place: next });

      expect(state.place).toEqual(next);
      expect(isPlaceLoading('lugar-2', state.resolvedId)).toBe(false);
    });

    it('el reintento invalida el id resuelto para volver a mostrar carga', () => {
      const resolved = placeReducer(INITIAL_PLACE_STATE, {
        type: 'loadSucceeded',
        requestedId: 'lugar-1',
        place,
      });
      const reloading = placeReducer(resolved, { type: 'loadStarted' });

      expect(reloading.resolvedId).toBeNull();
      expect(isPlaceLoading('lugar-1', reloading.resolvedId)).toBe(true);
    });

    it('un fallo asocia el error al id consultado (la pantalla puede mostrarlo)', () => {
      const state = placeReducer(INITIAL_PLACE_STATE, {
        type: 'loadFailed',
        requestedId: 'lugar-1',
        errorKind: 'notFound',
      });

      expect(state).toEqual({
        place: null,
        resolvedId: 'lugar-1',
        errorKind: 'notFound',
      });
      expect(isPlaceLoading('lugar-1', state.resolvedId)).toBe(false);
    });

    it('una resolución exitosa limpia un error previo', () => {
      const failed = placeReducer(INITIAL_PLACE_STATE, {
        type: 'loadFailed',
        requestedId: 'lugar-1',
        errorKind: 'network',
      });
      const state = placeReducer(failed, {
        type: 'loadSucceeded',
        requestedId: 'lugar-1',
        place,
      });

      expect(state.errorKind).toBeNull();
      expect(state.place).toEqual(place);
    });

    it('sin id no hay carga posible', () => {
      expect(isPlaceLoading(undefined, null)).toBe(false);
      expect(isPlaceLoading(undefined, 'lugar-1')).toBe(false);
    });
  });
});
