/**
 * Servicio de Exportación e Impresión de Reportes en PDF para Chaski (Serie AX).
 *
 * Utiliza:
 * - `expo-print` para compilar la plantilla HTML a PDF.
 * - `expo-file-system` (API moderna: File, Directory, Paths) para descarga directa.
 * - `expo-sharing` para diálogo nativo de guardado/compartir.
 */

import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { AdminReportsResult } from '../interfaces/admin.interface';
import { generateReportHtml, type ReportPdfOptions } from '../utils/report-pdf-template';
import {
  notifyDownloadCompleted,
  notifyDownloadStarted,
} from './admin-pdf-notification.service';

export interface ExportReportPdfResult {
  success: boolean;
  uri?: string;
  savedDirectly?: boolean;
  error?: string;
}

function getSanitizedFileName(prefix = 'Reporte_Chaski'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}_${timestamp}.pdf`;
}

/**
 * Descarga el archivo PDF directamente en el dispositivo.
 *
 * - En Web: genera una descarga directa en el navegador vía blob/data URL.
 * - En Android: utiliza `StorageAccessFramework` para guardar directamente en la carpeta
 *   que el usuario elija (ej. Descargas / Documentos). Si el usuario cancela, guarda
 *   en `documentDirectory` y abre el menú nativo para guardado.
 * - En iOS: escribe en `documentDirectory` y abre el diálogo nativo "Guardar en Archivos" / Compartir.
 */
export async function downloadAdminReportPdf(
  reports: AdminReportsResult,
  options: ReportPdfOptions = {},
): Promise<ExportReportPdfResult> {
  try {
    if (!reports || !reports.kpis) {
      return {
        success: false,
        error: 'No hay datos de reportes disponibles para descargar el documento PDF.',
      };
    }

    const html = generateReportHtml(reports, options);
    const fileName = getSanitizedFileName('Reporte_Estadistico_Chaski');

    // Avisar inicio de descarga mediante notificación local
    const notificationId = await notifyDownloadStarted(fileName);

    // 1. Entorno Web
    if (Platform.OS === 'web') {
      try {
        const file = await Print.printToFileAsync({ html, base64: true });
        if (file.base64 && typeof document !== 'undefined') {
          const link = document.createElement('a');
          link.href = `data:application/pdf;base64,${file.base64}`;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          await notifyDownloadCompleted(notificationId, fileName, link.href);
          return { success: true, savedDirectly: true };
        }
      } catch {
        // Fallback a print en web si no permite descarga directa
        await Print.printAsync({ html });
        return { success: true, savedDirectly: true };
      }
    }

    // 2. Entorno Móvil: Generar PDF con contenido Base64
    const file = await Print.printToFileAsync({
      html,
      base64: true,
    });

    if (!file.base64) {
      throw new Error('No se pudo generar la codificación Base64 del archivo PDF.');
    }

    // 2.1 Android: Guardar directamente mediante Directory.pickDirectoryAsync (API moderna de FileSystem)
    if (Platform.OS === 'android' && typeof Directory.pickDirectoryAsync === 'function') {
      try {
        const selectedDir = await Directory.pickDirectoryAsync();
        if (selectedDir && selectedDir.uri) {
          const destinationFile = selectedDir.createFile(fileName, 'application/pdf');
          await destinationFile.write(file.base64, { encoding: 'base64' });

          await notifyDownloadCompleted(notificationId, fileName, destinationFile.uri);

          return {
            success: true,
            uri: destinationFile.uri,
            savedDirectly: true,
          };
        }
      } catch (safErr) {
        console.warn('Directorio no seleccionado en Android, recurriendo a guardado en sandbox:', safErr);
      }
    }

    // 2.2 Fallback para Android (si cancela selección) y flujo nativo en iOS:
    // Guardar en `Paths.document` con `new File` garantiza que el archivo resida DENTRO del
    // almacenamiento permitido de la aplicación, resolviendo el error 'Not allowed to read file'
    const targetFile = new File(Paths.document, fileName);
    await targetFile.write(file.base64, { encoding: 'base64' });

    await notifyDownloadCompleted(notificationId, fileName, targetFile.uri);

    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(targetFile.uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: options.titulo ?? 'Guardar o Compartir Reporte PDF',
      });
      return {
        success: true,
        uri: targetFile.uri,
        savedDirectly: true,
      };
    }

    // Fallback final a print del archivo generado
    await Print.printAsync({ uri: targetFile.uri });
    return { success: true, uri: targetFile.uri };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido al descargar el archivo PDF.';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Abre el diálogo de impresión nativo del sistema (PrintManager en Android, UIPrint en iOS, Print en Web).
 */
export async function printAdminReportPdf(
  reports: AdminReportsResult,
  options: ReportPdfOptions = {},
): Promise<ExportReportPdfResult> {
  try {
    if (!reports || !reports.kpis) {
      return {
        success: false,
        error: 'No hay datos de reportes disponibles para imprimir.',
      };
    }

    const html = generateReportHtml(reports, options);
    await Print.printAsync({ html });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido al imprimir el reporte.';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Función legacy/unificada para compatibilidad.
 */
export async function exportAdminReportPdf(
  reports: AdminReportsResult,
  options: ReportPdfOptions = {},
): Promise<ExportReportPdfResult> {
  return downloadAdminReportPdf(reports, options);
}
