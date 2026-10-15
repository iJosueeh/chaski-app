import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import type { UserRole } from '../interfaces/admin.interface';

export interface AdminFiltersProps {
  search: string;
  onSearchChange: (text: string) => void;
  filtroRol: UserRole | null;
  onRolChange: (rol: UserRole | null) => void;
  filtroEstado: boolean | null;
  onEstadoChange: (estado: boolean | null) => void;
  onResetFilters?: () => void;
}

export function AdminFilters({
  search,
  onSearchChange,
  filtroRol,
  onRolChange,
  filtroEstado,
  onEstadoChange,
  onResetFilters,
}: AdminFiltersProps) {
  const hasActiveFilters = Boolean(search || filtroRol !== null || filtroEstado !== null);

  return (
    <View style={styles.container}>
      {/* Buscador */}
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o correo..."
          placeholderTextColor={Colors.light.textSecondary}
          value={search}
          onChangeText={onSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="admin-search-input"
        />
        {search.length > 0 && (
          <Pressable
            style={styles.clearSearchButton}
            onPress={() => onSearchChange('')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Limpiar búsqueda"
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Chips de filtro */}
      <View style={styles.filtersRow}>
        {/* Filtro por Rol */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>ROL:</Text>
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, filtroRol === null && styles.chipActive]}
              onPress={() => onRolChange(null)}
              testID="filter-rol-todos"
            >
              <Text style={[styles.chipText, filtroRol === null && styles.chipTextActive]}>Todos</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, filtroRol === 'USUARIO' && styles.chipActive]}
              onPress={() => onRolChange('USUARIO')}
              testID="filter-rol-usuario"
            >
              <Text style={[styles.chipText, filtroRol === 'USUARIO' && styles.chipTextActive]}>
                Usuarios
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, filtroRol === 'ADMIN' && styles.chipActive]}
              onPress={() => onRolChange('ADMIN')}
              testID="filter-rol-admin"
            >
              <Text style={[styles.chipText, filtroRol === 'ADMIN' && styles.chipTextActive]}>
                Admins
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Filtro por Estado */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>ESTADO:</Text>
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, filtroEstado === null && styles.chipActive]}
              onPress={() => onEstadoChange(null)}
              testID="filter-estado-todos"
            >
              <Text style={[styles.chipText, filtroEstado === null && styles.chipTextActive]}>
                Todos
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, filtroEstado === true && styles.chipActive]}
              onPress={() => onEstadoChange(true)}
              testID="filter-estado-activo"
            >
              <Text style={[styles.chipText, filtroEstado === true && styles.chipTextActive]}>
                Activos
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, filtroEstado === false && styles.chipActive]}
              onPress={() => onEstadoChange(false)}
              testID="filter-estado-suspendido"
            >
              <Text style={[styles.chipText, filtroEstado === false && styles.chipTextActive]}>
                Suspendidos
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Botón restablecer si hay filtros aplicados */}
      {hasActiveFilters && onResetFilters && (
        <Pressable
          style={styles.resetButton}
          onPress={onResetFilters}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Restablecer todos los filtros"
        >
          <Text style={styles.resetButtonText}>Limpiar todos los filtros</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  searchWrapper: {
    position: 'relative',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 42,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.light.text,
  },
  clearSearchButton: {
    position: 'absolute',
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    fontSize: 11,
    color: Colors.light.brand,
    fontWeight: '700',
  },
  filtersRow: {
    gap: 10,
  },
  filterGroup: {
    gap: 6,
  },
  filterLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  chipActive: {
    borderColor: Colors.light.accent,
    backgroundColor: '#FAF3E3',
  },
  chipText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  chipTextActive: {
    fontFamily: Fonts.mono,
    fontWeight: '700',
    color: Colors.light.brand,
  },
  resetButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  resetButtonText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.light.primary,
    textDecorationLine: 'underline',
  },
});
