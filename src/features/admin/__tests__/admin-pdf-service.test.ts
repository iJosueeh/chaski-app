import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import { Directory } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { AdminReportsResult } from '../interfaces/admin.interface';
import {
  downloadAdminReportPdf,
  exportAdminReportPdf,
  printAdminReportPdf,
} from '../services/admin-pdf.service';

vi.mock('react-native', () => {
  const currentPlatform = {
    OS: 'ios',
    select: (dict: Record<string, unknown>) => dict.ios ?? dict.default,
  };
  return {
    Platform: currentPlatform,
  };
});

vi.mock('expo-print', () => ({
  printAsync: vi.fn(),
  printToFileAsync: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

const { mockFileWrite, mockCreateFile, mockPickDirectoryAsync } = vi.hoisted(() => {
  const fileWrite = vi.fn();
  const createFile = vi.fn((name: string) => ({
    uri: `content://selected/directory/${name}`,
    write: fileWrite,
  }));
  const pickDirectoryAsync = vi.fn();
  return {
    mockFileWrite: fileWrite,
    mockCreateFile: createFile,
    mockPickDirectoryAsync: pickDirectoryAsync,
  };
});

vi.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(...args: unknown[]) {
      this.uri = args
        .map((a) =>
          typeof a === 'object' && a !== null && 'uri' in a
            ? (a as { uri: string }).uri
            : String(a),
        )
        .join('/');
    }
    write = mockFileWrite;
  }

  class MockDirectory {
    uri: string;
    constructor(...args: unknown[]) {
      this.uri = args
        .map((a) =>
          typeof a === 'object' && a !== null && 'uri' in a
            ? (a as { uri: string }).uri
            : String(a),
        )
        .join('/');
    }
    createFile = mockCreateFile;
    static pickDirectoryAsync = mockPickDirectoryAsync;
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      document: new MockDirectory('file:///data/user/0/chaski/files'),
      cache: new MockDirectory('file:///data/user/0/chaski/cache'),
    },
  };
});

describe('Admin PDF Service (Serie AX)', () => {
  const mockReports: AdminReportsResult = {
    rango: {
      periodo: '7d',
      desde: '2026-11-11T00:00:00Z',
      hasta: '2026-11-18T00:00:00Z',
      agrupacion: 'dia',
    },
    kpis: {
      solicitudes_total: 10,
      expediciones_total: 8,
      expediciones_completadas: 6,
      expediciones_parciales: 1,
      expediciones_abandonadas: 1,
      tasa_finalizacion: 75.0,
      tasa_conversion_solicitudes: 80.0,
      paradas_visitadas_total: 20,
    },
    categorias_ranking: [],
    destinos_incluidos_ranking: [],
    destinos_visitados_ranking: [],
    evolucion: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validación y Errores', () => {
    it('retorna error si los datos de reportes son nulos o incompletos', async () => {
      const res = await downloadAdminReportPdf(null as unknown as AdminReportsResult);
      expect(res.success).toBe(false);
      expect(res.error).toContain('No hay datos');
    });

    it('captura excepciones generales y retorna { success: false, error }', async () => {
      const originalOS = Platform.OS;
      (Platform as { OS: string }).OS = 'ios';

      (Print.printToFileAsync as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Print engine failure'),
      );

      const res = await downloadAdminReportPdf(mockReports);

      expect(res.success).toBe(false);
      expect(res.error).toBe('Print engine failure');

      (Platform as { OS: string }).OS = originalOS;
    });
  });

  describe('Descarga Directa (downloadAdminReportPdf)', () => {
    it('en Android guarda directamente con Directory.pickDirectoryAsync si el usuario selecciona carpeta', async () => {
      const originalOS = Platform.OS;
      (Platform as { OS: string }).OS = 'android';

      (Print.printToFileAsync as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        uri: 'file:///temp.pdf',
        base64: 'JVBERi0xLjQK...',
      });

      mockPickDirectoryAsync.mockResolvedValueOnce({
        uri: 'content://selected/directory',
        createFile: mockCreateFile,
      });

      const res = await downloadAdminReportPdf(mockReports);

      expect(Directory.pickDirectoryAsync).toHaveBeenCalled();
      expect(mockCreateFile).toHaveBeenCalledWith(
        expect.stringMatching(/Reporte_Estadistico_Chaski.*\.pdf/),
        'application/pdf',
      );
      expect(mockFileWrite).toHaveBeenCalledWith(
        'JVBERi0xLjQK...',
        { encoding: 'base64' },
      );
      expect(res.success).toBe(true);
      expect(res.savedDirectly).toBe(true);

      (Platform as { OS: string }).OS = originalOS;
    });

    it('en Android si el usuario cancela la selección de carpeta, guarda en Paths.document y comparte con Sharing', async () => {
      const originalOS = Platform.OS;
      (Platform as { OS: string }).OS = 'android';

      (Print.printToFileAsync as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        uri: 'file:///temp.pdf',
        base64: 'JVBERi0xLjQK...',
      });

      mockPickDirectoryAsync.mockRejectedValueOnce(new Error('User cancelled picker'));

      (Sharing.isAvailableAsync as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

      const res = await downloadAdminReportPdf(mockReports);

      expect(mockFileWrite).toHaveBeenCalledWith(
        'JVBERi0xLjQK...',
        { encoding: 'base64' },
      );
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringContaining('file:///data/user/0/chaski/files/'),
        expect.objectContaining({ mimeType: 'application/pdf' }),
      );
      expect(res.success).toBe(true);

      (Platform as { OS: string }).OS = originalOS;
    });

    it('en iOS escribe en Paths.document y abre el menú nativo de compartir / guardar', async () => {
      const originalOS = Platform.OS;
      (Platform as { OS: string }).OS = 'ios';

      (Print.printToFileAsync as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        uri: 'file:///temp.pdf',
        base64: 'JVBERi0xLjQK...',
      });

      (Sharing.isAvailableAsync as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

      const res = await downloadAdminReportPdf(mockReports);

      expect(mockFileWrite).toHaveBeenCalledWith(
        'JVBERi0xLjQK...',
        { encoding: 'base64' },
      );
      expect(Sharing.shareAsync).toHaveBeenCalled();
      expect(res.success).toBe(true);

      (Platform as { OS: string }).OS = originalOS;
    });
  });

  describe('Impresión Directa (printAdminReportPdf)', () => {
    it('invoca Print.printAsync({ html }) pasando el HTML compilado', async () => {
      (Print.printAsync as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      const res = await printAdminReportPdf(mockReports);

      expect(Print.printAsync).toHaveBeenCalledTimes(1);
      expect(Print.printAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('CHASKI EXPEDICIONES'),
        }),
      );
      expect(res.success).toBe(true);
    });
  });

  describe('Compatibilidad Legacy (exportAdminReportPdf)', () => {
    it('re-dirige a downloadAdminReportPdf', async () => {
      (Print.printToFileAsync as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        uri: 'file:///temp.pdf',
        base64: 'JVBERi0xLjQK...',
      });
      (Sharing.isAvailableAsync as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

      const res = await exportAdminReportPdf(mockReports);
      expect(res.success).toBe(true);
    });
  });
});
