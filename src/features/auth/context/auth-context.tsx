import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { updateProfile } from "../services/auth.service";
import {
  replaceUserAvatar,
  removeUserAvatar,
  processPendingAvatarCleanups,
} from "../services/profile-storage.service";
import { validateProfileName } from "../utils/profile-validation";
import { fetchUserProfileRecord } from "../services/profile-record.service";
import type {
  UserProfileRecord,
  UserRole,
  UserAccountStatus,
} from "../interfaces/auth.interfaces";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (isRecovery: boolean) => void;
  isRecoveryVerified: boolean;
  setIsRecoveryVerified: (isVerified: boolean) => void;
  setSession: (session: Session | null) => void;
  updateProfileName: (
    nombre: string,
  ) => Promise<{ success: boolean; error?: string; user?: User | null }>;
  updateProfileAvatar: (
    localUri: string,
    base64?: string | null,
  ) => Promise<{ success: boolean; error?: string; avatarUrl?: string }>;
  removeProfileAvatar: () => Promise<{ success: boolean; error?: string }>;
  userProfile: UserProfileRecord | null;
  userRole: UserRole;
  accountStatus: UserAccountStatus;
  isAdmin: boolean;
  isAccountSuspended: boolean;
  profileLoading: boolean;
  refreshUserProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isPasswordRecovery: false,
  setIsPasswordRecovery: () => {},
  isRecoveryVerified: false,
  setIsRecoveryVerified: () => {},
  setSession: () => {},
  updateProfileName: async () => ({ success: false }),
  updateProfileAvatar: async () => ({ success: false }),
  removeProfileAvatar: async () => ({ success: false }),
  userProfile: null,
  userRole: "USUARIO",
  accountStatus: "cargando",
  isAdmin: false,
  isAccountSuspended: false,
  profileLoading: true,
  refreshUserProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isRecoveryVerified, setIsRecoveryVerified] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(
    null,
  );
  const [userRole, setUserRole] = useState<UserRole>("USUARIO");
  const [accountStatus, setAccountStatus] =
    useState<UserAccountStatus>("cargando");
  const [profileLoading, setProfileLoading] = useState(true);

  const isAdmin = userRole === "ADMIN";
  const isAccountSuspended = accountStatus === "suspendido";

  const refreshUserProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setUserProfile(null);
      setUserRole("USUARIO");
      setAccountStatus("sesion_ausente");
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const { data, isNetworkError } = await fetchUserProfileRecord(
      session.user.id,
    );
    if (isNetworkError) {
      setAccountStatus("error_red");
    } else if (data) {
      setUserProfile(data);
      setUserRole(data.rol);
      setAccountStatus(data.estado ? "activo" : "suspendido");
    } else {
      setAccountStatus("activo");
      setUserRole("USUARIO");
    }
    setProfileLoading(false);
  }, [session]);

  const updateProfileName = useCallback(async (nombre: string) => {
    const validation = validateProfileName(nombre);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const { data, error } = await updateProfile({
      nombre: validation.trimmedName!,
    });
    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user) {
      setSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          user: data.user,
        };
      });
      setUserProfile((prev) =>
        prev ? { ...prev, nombre: validation.trimmedName! } : null,
      );
    }

    return { success: true, user: data.user };
  }, []);

  const updateProfileAvatar = useCallback(
    async (localUri: string, base64?: string | null) => {
      if (!session?.user) {
        return { success: false, error: "No hay sesión de usuario activa" };
      }

      const currentAvatarUrl = session.user.user_metadata?.avatar_url as
        | string
        | undefined;
      const res = await replaceUserAvatar({
        userId: session.user.id,
        localUri,
        base64,
        currentAvatarUrl,
      });

      if (res.success && res.user) {
        const updatedUser = res.user;
        setSession((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            user: updatedUser,
          };
        });
        return { success: true, avatarUrl: res.avatarUrl };
      }

      return { success: false, error: res.error };
    },
    [session],
  );

  const removeProfileAvatar = useCallback(async () => {
    if (!session?.user) {
      return { success: false, error: "No hay sesión de usuario activa" };
    }

    const currentAvatarUrl = session.user.user_metadata?.avatar_url as
      | string
      | undefined;
    const res = await removeUserAvatar({
      userId: session.user.id,
      currentAvatarUrl,
    });

    if (res.success && res.user) {
      const updatedUser = res.user;
      setSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          user: updatedUser,
        };
      });
      return { success: true };
    }

    return { success: false, error: res.error };
  }, [session]);

  useEffect(() => {
    let isCancelled = false;

    const syncProfile = async (targetSession: Session | null) => {
      if (!targetSession?.user?.id) {
        if (!isCancelled) {
          setUserProfile(null);
          setUserRole("USUARIO");
          setAccountStatus("sesion_ausente");
          setProfileLoading(false);
        }
        return;
      }

      if (!isCancelled) {
        setProfileLoading(true);
      }

      const { data, isNetworkError } = await fetchUserProfileRecord(
        targetSession.user.id,
      );
      if (isCancelled) return;

      if (isNetworkError) {
        setAccountStatus("error_red");
      } else if (data) {
        setUserProfile(data);
        setUserRole(data.rol);
        setAccountStatus(data.estado ? "activo" : "suspendido");
      } else {
        setAccountStatus("activo");
        setUserRole("USUARIO");
      }
      setProfileLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (isCancelled) return;
      setSession(initialSession);
      setLoading(false);
      if (initialSession?.user?.id) {
        processPendingAvatarCleanups(initialSession.user.id).catch(() => {});
      }
      syncProfile(initialSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (isCancelled) return;
      setSession(currentSession);
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      } else if (event === "SIGNED_OUT") {
        setIsPasswordRecovery(false);
        setIsRecoveryVerified(false);
      }
      syncProfile(currentSession);
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        isPasswordRecovery,
        setIsPasswordRecovery,
        isRecoveryVerified,
        setIsRecoveryVerified,
        setSession,
        updateProfileName,
        updateProfileAvatar,
        removeProfileAvatar,
        userProfile,
        userRole,
        accountStatus,
        isAdmin,
        isAccountSuspended,
        profileLoading,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
