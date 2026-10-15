import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';

/**
 * Franja decorativa de tocapus andinos estilizados (Serie AX).
 */
export function AndeanTocapuBand() {
  return (
    <View style={styles.tocapuBand} accessible={false} importantForAccessibility="no">
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuDiamond} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuSquareInSquare} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuSteppedCross} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuDiamondGold} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuSteppedCross} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuSquareInSquare} />
      </View>
      <View style={styles.tocapuCell}>
        <View style={styles.tocapuDiamond} />
      </View>
    </View>
  );
}

export interface AuthTicketLayoutProps {
  serie: string;
  title: string;
  subtitle?: string;
  footerFolio?: string;
  children: React.ReactNode;
  showTocapuBand?: boolean;
  contentMaxWidth?: number;
  scrollViewRef?: React.Ref<ScrollView>;
  scrollViewProps?: Partial<ScrollViewProps>;
  bottomDecorativeContent?: React.ReactNode;
}

/**
 * Layout base responsive para las pantallas de autenticación "Boleto Serie AX".
 *
 * Características de diseño y ergonomía:
 * - Totalmente desacoplado de AuthContext, Supabase y Expo Router.
 * - Respeta insets de Safe Area (iOS Dynamic Island/notch y barras de gestos Android).
 * - Delimita ancho máximo (maxWidth: 480 por defecto) para tablets, web y orientación horizontal.
 * - Elimina el centrado vertical rígido que dejaba espacios muertos excesivos en móviles altos.
 * - Evita colisiones de KeyboardAvoidingView en Android donde el sistema ya aplica resize nativo.
 * - Permite desplazamiento fluido hasta el final del formulario y botón de acción.
 * - Admite contenido decorativo opcional inferior (sellos, marcas de agua) sin acoplar lógica de pantallas.
 */
export function AuthTicketLayout({
  serie,
  title,
  subtitle,
  footerFolio = 'EMPRESA DE TRANSPORTES CHASKI · LÍNEA CULTURAL',
  children,
  showTocapuBand = true,
  contentMaxWidth = 480,
  scrollViewRef,
  scrollViewProps,
  bottomDecorativeContent,
}: AuthTicketLayoutProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Detección de pantallas compactas (landscape o teléfonos pequeños)
  const isCompactHeight = height < 680;
  const isTabletOrWide = width >= 600;

  return (
    <View style={[styles.canvas, !isTabletOrWide && styles.canvasMobile]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.keyboardContainer}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isTabletOrWide ? styles.scrollContentTablet : styles.scrollContentMobile,
            isTabletOrWide && {
              paddingTop: Math.max(insets.top, 16) + (isCompactHeight ? 8 : 16),
              paddingBottom: Math.max(insets.bottom, 16) + 36,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={true}
          {...scrollViewProps}
        >
          {/* Tarjeta del Boleto Serie AX */}
          <View
            style={[
              styles.ticket,
              isTabletOrWide
                ? [styles.ticketTablet, { maxWidth: contentMaxWidth }]
                : styles.ticketMobile,
            ]}
          >
            {/* Franja superior (marca + serie) */}
            <View
              style={[
                styles.ticketHeader,
                !isTabletOrWide && {
                  paddingTop: Math.max(insets.top, 16) + (isCompactHeight ? 8 : 14),
                },
                isCompactHeight && styles.ticketHeaderCompact,
              ]}
            >
              <Text style={[styles.brand, isCompactHeight && styles.brandCompact]}>CHASKI</Text>
              <Text style={styles.serie}>{serie}</Text>
            </View>

            {/* Separadores dorados y tocapus */}
            <View style={styles.goldRule} />
            {showTocapuBand && <AndeanTocapuBand />}
            <View style={styles.goldRule} />

            {/* Cuerpo del boleto */}
            <View
              style={[
                styles.ticketBody,
                !isTabletOrWide && styles.ticketBodyMobile,
                Boolean(bottomDecorativeContent) && styles.ticketBodyWithDecorative,
                isCompactHeight && styles.ticketBodyCompact,
              ]}
            >
              <View style={styles.ticketMainContent}>
                <Text style={[styles.title, isCompactHeight && styles.titleCompact]}>{title}</Text>
                {subtitle ? (
                  <Text style={[styles.subtitle, isCompactHeight && styles.subtitleCompact]}>
                    {subtitle}
                  </Text>
                ) : null}

                {children}
              </View>

              {bottomDecorativeContent ? (
                <View style={styles.bottomDecorativeContainer}>
                  {bottomDecorativeContent}
                </View>
              ) : null}
            </View>

            {/* Separadores dorados inferiores y tocapus */}
            <View style={styles.goldRule} />
            {showTocapuBand && <AndeanTocapuBand />}
            <View style={styles.goldRule} />

            {/* Franja inferior (folio) */}
            <View
              style={[
                styles.ticketFooter,
                !isTabletOrWide && {
                  paddingBottom: Math.max(insets.bottom, 14) + (isCompactHeight ? 8 : 14),
                },
                isCompactHeight && styles.ticketFooterCompact,
              ]}
            >
              <Text style={styles.folio}>{footerFolio}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  canvasMobile: {
    backgroundColor: Colors.light.surface,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentTablet: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  scrollContentMobile: {
    alignItems: 'stretch',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  ticket: {
    width: '100%',
    backgroundColor: Colors.light.surface,
  },
  ticketTablet: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.shadowStrong,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
    overflow: 'hidden',
  },
  ticketMobile: {
    flex: 1,
    flexGrow: 1,
    borderRadius: 0,
    borderWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  ticketHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  ticketHeaderCompact: {
    paddingTop: 14,
    paddingBottom: 10,
  },
  brand: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 6,
    color: Colors.light.brand,
  },
  brandCompact: {
    fontSize: 28,
    letterSpacing: 4,
  },
  serie: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  goldRule: {
    height: 2,
    backgroundColor: Colors.light.accent,
    opacity: 0.7,
  },
  tocapuBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 5,
    backgroundColor: Colors.light.backgroundElement,
  },
  tocapuCell: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surface,
  },
  tocapuDiamond: {
    width: 6,
    height: 6,
    backgroundColor: Colors.light.primary,
    transform: [{ rotate: '45deg' }],
  },
  tocapuDiamondGold: {
    width: 6,
    height: 6,
    backgroundColor: Colors.light.accent,
    transform: [{ rotate: '45deg' }],
  },
  tocapuSquareInSquare: {
    width: 6,
    height: 6,
    backgroundColor: Colors.light.brand,
  },
  tocapuSteppedCross: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: 'transparent',
  },
  ticketBody: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  ticketBodyMobile: {
    flex: 1,
    flexGrow: 1,
  },
  ticketBodyWithDecorative: {
    justifyContent: 'space-around',
  },
  ticketBodyCompact: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  ticketMainContent: {
    width: '100%',
  },
  bottomDecorativeContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
  },
  titleCompact: {
    fontSize: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  ticketFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ticketFooterCompact: {
    paddingVertical: 10,
  },
  folio: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.light.textSecondary,
  },
});
