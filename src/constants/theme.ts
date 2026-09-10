/**
 * Sistema de diseño Chaski — "Boleto de Experiencias" (Serie AX)
 * Paleta y tipografías extraídas del diseño oficial de Figma.
 *
 * Identidad visual: boleto vintage de transporte, con pergamino crema,
 * acentos dorados (D4AF37), tinta marrón (4A2E18) y terracota (9C3E1B).
 *
 * Se mantienen las claves base (text, background, backgroundElement,
 * backgroundSelected, textSecondary) para no romper ThemedText/ThemedView,
 * y se añaden las claves de identidad (primary, accent, brand, surface,
 * carmine, etc.).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // --- Claves base (compatibilidad) ---
    text: '#4A2E18',            // Marrón tinta (texto principal)
    background: '#FAF5EE',      // Crema pergamino (lienzo)
    backgroundElement: '#F0E8D8', // Arena (inputs, fondos secundarios)
    backgroundSelected: '#E8DCC5', // Arena oscura (seleccionado)
    textSecondary: '#8A7C64',   // Taupe cálido (texto secundario)

    // --- Identidad "Boleto de Experiencias" ---
    primary: '#9C3E1B',         // Terracota (CTA, botones primarios)
    primaryDark: '#7A2F15',     // Terracota pressed
    accent: '#D4AF37',          // Dorado ocre (sellos, recompensas, highlights)
    brand: '#4A2E18',           // Marrón profundo (logo, tinta)
    surface: '#FFFDF9',         // Blanco cálido (tarjetas)
    carmine: '#B71C1C',         // Rojo carmín (acentos de serie, error)
    error: '#B71C1C',
    success: '#7A9E6D',         // Verde oliva
    border: '#E2D7C3',          // Borde sutil (grecas)
    shadow: 'rgba(74, 46, 24, 0.08)',
    shadowStrong: 'rgba(74, 46, 24, 0.16)',
  },
  dark: {
    text: '#F5EFE4',
    background: '#1E1712',
    backgroundElement: '#2A2119',
    backgroundSelected: '#3A2E22',
    textSecondary: '#B0A694',
    primary: '#C25E3A',
    primaryDark: '#A64D2F',
    accent: '#D4AF37',
    brand: '#D4AF37',
    surface: '#2A2119',
    carmine: '#E53935',
    error: '#E53935',
    success: '#8FBF7F',
    border: '#3A2E22',
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowStrong: 'rgba(0, 0, 0, 0.5)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Tipografías del diseño de Figma:
 * - Cinzel (títulos serif, look de boleto impreso)
 * - Platypi (headings editoriales)
 * - Inter (cuerpo de lectura)
 * - IBM Plex Mono (folios, sellos, numeración de serie)
 */
export const Fonts = {
  serif: 'Cinzel',        // títulos grandes, "CHASKI"
  display: 'Platypi',     // headings editoriales
  sans: 'Inter',          // cuerpo
  mono: 'IBM Plex Mono',  // folios, sellos, "SERIE AX · NRO 00001"
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
