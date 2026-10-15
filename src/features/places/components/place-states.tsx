import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors, Fonts } from "@/constants/theme";

const palette = Colors.light;

export interface PlaceLoadingStateProps {
  message: string;
}

export function PlaceLoadingState({ message }: PlaceLoadingStateProps) {
  return (
    <View
      style={styles.centered}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <ActivityIndicator size="large" color={palette.primary} />
      <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
        {message}
      </Text>
      <View style={[styles.loadingRule, { backgroundColor: palette.accent }]} />
    </View>
  );
}

export interface PlaceEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function PlaceEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: PlaceEmptyStateProps) {
  return (
    <View
      style={[
        styles.ticketCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: palette.accent }]} />
      <View style={styles.cardContent}>
        <View
          style={[
            styles.iconCircle,
            {
              borderColor: palette.primary,
              backgroundColor: palette.backgroundElement,
            },
          ]}
        >
          <View style={[styles.diamondOuter, { borderColor: palette.accent }]}>
            <View
              style={[styles.diamondInner, { borderColor: palette.primary }]}
            />
            <View
              style={[styles.diamondDot, { backgroundColor: palette.primary }]}
            />
          </View>
        </View>

        <Text style={[styles.stateKicker, { color: palette.primary }]}>
          SIN REGISTROS
        </Text>
        <Text style={[styles.stateTitle, { color: palette.brand }]}>
          {title}
        </Text>
        <Text style={[styles.stateText, { color: palette.textSecondary }]}>
          {description}
        </Text>

        {actionLabel && onAction ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            activeOpacity={0.85}
            onPress={onAction}
            style={[
              styles.primaryButton,
              { backgroundColor: palette.primary, borderColor: palette.brand },
            ]}
          >
            <Text
              style={[styles.primaryButtonText, { color: palette.surface }]}
            >
              {actionLabel.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export interface PlaceErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  onBack?: () => void;
  backLabel?: string;
}

export function PlaceErrorState({
  title = "No pudimos cargar el catálogo",
  message,
  onRetry,
  retryLabel = "Reintentar",
  onBack,
  backLabel = "Volver",
}: PlaceErrorStateProps) {
  return (
    <View
      style={[
        styles.ticketCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
      accessibilityRole="alert"
    >
      <View style={[styles.accentBar, { backgroundColor: palette.burgundy }]} />
      <View style={styles.cardContent}>
        <View
          style={[
            styles.iconCircle,
            {
              borderColor: palette.burgundy,
              backgroundColor: palette.backgroundElement,
            },
          ]}
        >
          <Text style={[styles.errorGlyph, { color: palette.burgundy }]}>
            !
          </Text>
        </View>
        <Text style={[styles.stateKicker, { color: palette.burgundy }]}>
          CONTROL DE SERIE
        </Text>
        <Text style={[styles.stateTitle, { color: palette.brand }]}>
          {title}
        </Text>
        <Text style={[styles.stateText, { color: palette.textSecondary }]}>
          {message}
        </Text>
        <View style={styles.actionsRow}>
          {onRetry ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={retryLabel}
              activeOpacity={0.85}
              onPress={onRetry}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: palette.primary,
                  borderColor: palette.brand,
                },
              ]}
            >
              <Text
                style={[styles.primaryButtonText, { color: palette.surface }]}
              >
                {retryLabel.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ) : null}
          {onBack ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              activeOpacity={0.75}
              onPress={onBack}
              style={[styles.secondaryButton, { borderColor: palette.primary }]}
            >
              <Text
                style={[styles.secondaryButtonText, { color: palette.primary }]}
              >
                {backLabel.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  loadingText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    textAlign: "center",
  },
  loadingRule: {
    width: 48,
    height: 1.5,
    opacity: 0.7,
  },
  ticketCard: {
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  accentBar: {
    height: 4,
    width: "100%",
  },
  cardContent: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  diamondOuter: {
    width: 24,
    height: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
  },
  diamondInner: {
    position: "absolute",
    width: 14,
    height: 14,
    borderWidth: 1,
    opacity: 0.7,
  },
  diamondDot: {
    width: 5,
    height: 5,
    borderRadius: 1,
  },
  errorGlyph: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    fontWeight: "700",
  },
  stateKicker: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  stateTitle: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  stateText: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  primaryButton: {
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  secondaryButton: {
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
