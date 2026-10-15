import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import type { AdminUser } from '../interfaces/admin.interface';

export interface AdminUserCardProps {
  user: AdminUser;
  isCurrentUser?: boolean;
  onPress: (user: AdminUser) => void;
}

export function AdminUserCard({ user, isCurrentUser, onPress }: AdminUserCardProps) {
  const initial = (user.nombre?.trim()?.[0] || user.email?.trim()?.[0] || 'U').toUpperCase();
  const isAdmin = user.rol === 'ADMIN';
  const isActivo = user.estado;

  const formattedDate = user.fecha_registro
    ? new Date(user.fecha_registro).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'No registrada';

  return (
    <Pressable
      style={styles.card}
      onPress={() => onPress(user)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalle de ${user.nombre || user.email}`}
      testID={`admin-user-card-${user.id}`}
    >
      <View style={styles.cardHeader}>
        {/* Avatar inicial */}
        <View style={[styles.avatarCircle, isAdmin && styles.avatarAdmin]}>
          <Text style={[styles.avatarText, isAdmin && styles.avatarTextAdmin]}>{initial}</Text>
        </View>

        {/* Datos principales */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.nombre || 'Sin nombre registrado'}
            </Text>
            {isCurrentUser && (
              <View style={styles.currentUserBadge}>
                <Text style={styles.currentUserText}>TÚ</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user.email || 'Sin correo registrado'}
          </Text>
        </View>

        {/* Indicador flecha */}
        <Text style={styles.chevron}>›</Text>
      </View>

      {/* Badges y fecha */}
      <View style={styles.cardFooter}>
        <View style={styles.badgesRow}>
          {/* Badge Rol */}
          <View style={[styles.badge, isAdmin ? styles.badgeAdmin : styles.badgeUser]}>
            <Text style={[styles.badgeText, isAdmin ? styles.badgeTextAdmin : styles.badgeTextUser]}>
              {isAdmin ? 'ADMIN' : 'USUARIO'}
            </Text>
          </View>

          {/* Badge Estado */}
          <View style={[styles.badge, isActivo ? styles.badgeActive : styles.badgeInactive]}>
            <Text
              style={[
                styles.badgeText,
                isActivo ? styles.badgeTextActive : styles.badgeTextInactive,
              ]}
            >
              {isActivo ? 'ACTIVO' : 'SUSPENDIDO'}
            </Text>
          </View>
        </View>

        <Text style={styles.dateText}>Reg: {formattedDate}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAdmin: {
    backgroundColor: '#FAF5E8',
    borderColor: Colors.light.accent,
  },
  avatarText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.brand,
  },
  avatarTextAdmin: {
    color: '#8C651E',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.brand,
    flexShrink: 1,
  },
  currentUserBadge: {
    backgroundColor: '#FAF3E3',
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.light.accent,
  },
  currentUserText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  userEmail: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  chevron: {
    fontSize: 20,
    color: Colors.light.border,
    fontFamily: Fonts.mono,
    marginLeft: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5EFE4',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeAdmin: {
    backgroundColor: '#FAF5E8',
    borderColor: '#EFE0B8',
  },
  badgeUser: {
    backgroundColor: '#F0EDE6',
    borderColor: Colors.light.border,
  },
  badgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeTextAdmin: {
    color: '#8C651E',
  },
  badgeTextUser: {
    color: Colors.light.textSecondary,
  },
  badgeActive: {
    backgroundColor: '#F0F7ED',
    borderColor: '#CDE5C5',
  },
  badgeInactive: {
    backgroundColor: '#FDF2F0',
    borderColor: '#F1CDCB',
  },
  badgeTextActive: {
    color: '#3B682D',
  },
  badgeTextInactive: {
    color: Colors.light.carmine,
  },
  dateText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
});
