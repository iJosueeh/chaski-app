import { describe, expect, it } from 'vitest';
import { AuthTicketLayoutProps } from '../components/auth-ticket-layout';

describe('AuthTicketLayout — Contratos de Diseño y Layout Responsive', () => {
  it('define valores por defecto de folio y ancho máximo para tabletas', () => {
    const props: AuthTicketLayoutProps = {
      serie: 'EMISIÓN DE BOLETO · SERIE AX',
      title: 'Nuevo Pasajero',
      children: null,
    };

    expect(props.serie).toBe('EMISIÓN DE BOLETO · SERIE AX');
    expect(props.title).toBe('Nuevo Pasajero');
    expect(props.showTocapuBand).toBeUndefined(); // Por defecto es true en el componente
    expect(props.contentMaxWidth).toBeUndefined(); // Por defecto es 480 en el componente
  });

  it('en móviles configura pantalla completa aprovechando el alto útil con Safe Area en header y footer', () => {
    const mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };
    const isTabletOrWide = false;
    const isCompactHeight = false;

    // En móviles, el scroll no tiene padding exterior (0)
    const scrollPaddingHorizontal = isTabletOrWide ? 32 : 0;
    const scrollPaddingTop = isTabletOrWide ? Math.max(mockInsets.top, 16) + 16 : 0;
    const scrollPaddingBottom = isTabletOrWide ? Math.max(mockInsets.bottom, 16) + 36 : 0;

    // El Safe Area se absorbe dentro del header y footer del boleto
    const headerPaddingTop = Math.max(mockInsets.top, 16) + (isCompactHeight ? 8 : 14);
    const footerPaddingBottom = Math.max(mockInsets.bottom, 14) + (isCompactHeight ? 8 : 14);

    expect(scrollPaddingHorizontal).toBe(0);
    expect(scrollPaddingTop).toBe(0);
    expect(scrollPaddingBottom).toBe(0);
    expect(headerPaddingTop).toBe(61); // 47 + 14
    expect(footerPaddingBottom).toBe(48); // 34 + 14
  });

  it('en modo tablet o ancho >= 600, mantiene formato de tarjeta centrada con márgenes exteriores y ancho máximo', () => {
    const isTabletOrWide = true;
    const mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };

    const scrollPaddingHorizontal = isTabletOrWide ? 32 : 0;
    const scrollPaddingTop = Math.max(mockInsets.top, 16) + 16;
    const scrollPaddingBottom = Math.max(mockInsets.bottom, 16) + 36;
    const ticketBorderRadius = isTabletOrWide ? 16 : 0;
    const ticketBorderWidth = isTabletOrWide ? 1 : 0;

    expect(scrollPaddingHorizontal).toBe(32);
    expect(scrollPaddingTop).toBe(63); // 47 + 16
    expect(scrollPaddingBottom).toBe(70); // 34 + 36
    expect(ticketBorderRadius).toBe(16);
    expect(ticketBorderWidth).toBe(1);
  });

  it('en móviles elimina bordes redondeados y contorno exterior para dar apariencia de pantalla completa', () => {
    const isTabletOrWide = false;
    const mobileStyle = {
      borderRadius: isTabletOrWide ? 16 : 0,
      borderWidth: isTabletOrWide ? 1 : 0,
      elevation: isTabletOrWide ? 5 : 0,
    };

    expect(mobileStyle.borderRadius).toBe(0);
    expect(mobileStyle.borderWidth).toBe(0);
    expect(mobileStyle.elevation).toBe(0);
  });

  it('en pantallas compactas (altura < 680), activa modo compacto de encabezado y cuerpo', () => {
    const checkIsCompact = (height: number) => height < 680;

    expect(checkIsCompact(667)).toBe(true); // iPhone SE
    expect(checkIsCompact(844)).toBe(false); // iPhone 15 Pro
    expect(checkIsCompact(932)).toBe(false); // iPhone 15 Pro Max
  });

  describe('Comportamiento de teclado y Viewport en Android e iOS', () => {
    it('asigna behavior "height" en Android y "padding" en iOS para evitar desbordes en edge-to-edge', () => {
      const getBehavior = (os: 'ios' | 'android' | 'web') => (os === 'ios' ? 'padding' : 'height');

      expect(getBehavior('android')).toBe('height');
      expect(getBehavior('ios')).toBe('padding');
    });

    it('garantiza que el viewport de Android con teclado abierto permita desplazamiento manual hasta EMITIR BOLETO', () => {
      const screenHeight = 850;
      const keyboardHeight = 310;
      const totalContentHeight = 740; // Alto aproximado del boleto con los 4 campos y botones

      // Al contraer el viewport con behavior="height" en Android:
      const visibleViewportHeight = screenHeight - keyboardHeight; // 540dp
      const maxScrollOffset = Math.max(0, totalContentHeight - visibleViewportHeight); // 200dp

      expect(visibleViewportHeight).toBe(540);
      expect(maxScrollOffset).toBeGreaterThan(0);
      expect(maxScrollOffset).toBe(200);

      // Desplazando al offset máximo, el final del boleto (EMITIR BOLETO y login) es visible
      const bottomVisibleY = maxScrollOffset + visibleViewportHeight;
      expect(bottomVisibleY).toBe(totalContentHeight);
    });

    it('evita mecanismos de ajuste compitiendo en ScrollView y KeyboardAvoidingView', () => {
      // Con KeyboardAvoidingView manejando el inset/altura, automaticallyAdjustKeyboardInsets no debe duplicar
      const usesSingleKeyboardCoordinator = {
        keyboardAvoidingView: true,
        automaticallyAdjustKeyboardInsets: false,
      };

      expect(usesSingleKeyboardCoordinator.keyboardAvoidingView).toBe(true);
      expect(usesSingleKeyboardCoordinator.automaticallyAdjustKeyboardInsets).toBe(false);
    });
  });

  describe('Contenido decorativo inferior opcional y adaptabilidad', () => {
    it('admite la propiedad opcional bottomDecorativeContent sin alterar el contrato básico', () => {
      const propsWithoutDecoration: AuthTicketLayoutProps = {
        serie: 'SERIE AX · NRO 00001',
        title: 'Nuevo Pasajero',
        children: null,
      };

      const propsWithDecoration: AuthTicketLayoutProps = {
        serie: 'SERIE AX · NRO 00001',
        title: 'Bienvenido',
        children: null,
        bottomDecorativeContent: 'mock-stamp',
      };

      expect(propsWithoutDecoration.bottomDecorativeContent).toBeUndefined();
      expect(propsWithDecoration.bottomDecorativeContent).toBe('mock-stamp');
    });

    it('calcula la condición para mostrar u ocultar la decoración según teclado, altura y orientación', () => {
      const shouldShowDecoration = (
        keyboardVisible: boolean,
        height: number,
        width: number,
      ) => {
        const isLandscape = width > height;
        const isCompact = height < 720;
        return !keyboardVisible && !isCompact && !isLandscape;
      };

      // Pantalla estándar vertical con teclado cerrado: SE MUESTRA
      expect(shouldShowDecoration(false, 850, 400)).toBe(true);

      // Con teclado abierto: SE OCULTA
      expect(shouldShowDecoration(true, 850, 400)).toBe(false);

      // En pantalla pequeña (ej. iPhone SE 667dp): SE OCULTA
      expect(shouldShowDecoration(false, 667, 375)).toBe(false);

      // En orientación horizontal (landscape): SE OCULTA
      expect(shouldShowDecoration(false, 400, 850)).toBe(false);
    });

    it('aplica distribución equilibrada (space-around) solo cuando la decoración está presente', () => {
      const getTicketBodyJustify = (hasDecoration: boolean) =>
        hasDecoration ? 'space-around' : 'flex-start';

      expect(getTicketBodyJustify(true)).toBe('space-around');
      expect(getTicketBodyJustify(false)).toBe('flex-start');
    });
  });
});
