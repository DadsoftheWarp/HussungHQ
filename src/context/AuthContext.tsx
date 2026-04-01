"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

interface AuthContextType {
  user: FirebaseUser | null;
  familyId: string | null;
  loading: boolean;
  googleCalendarToken: string | null;
  googleCalendarConnected: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  connectGoogleCalendar: () => Promise<void>;
  disconnectGoogleCalendar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  familyId: null,
  loading: true,
  googleCalendarToken: null,
  googleCalendarConnected: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  connectGoogleCalendar: async () => {},
  disconnectGoogleCalendar: async () => {},
});

async function ensureUserDoc(firebaseUser: FirebaseUser): Promise<string> {
  const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
  if (userDoc.exists()) {
    return userDoc.data().familyId || firebaseUser.uid;
  }
  const newFamilyId = firebaseUser.uid;
  await setDoc(doc(db, "users", firebaseUser.uid), {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    familyId: newFamilyId,
    color: "#6366f1",
  });
  await setDoc(doc(db, "families", newFamilyId), {
    createdAt: new Date().toISOString(),
    members: [firebaseUser.uid],
  });
  return newFamilyId;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleCalendarToken, setGoogleCalendarToken] = useState<string | null>(null);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);

  useEffect(() => {
    // Handle the redirect result when the page loads after a Google sign-in redirect
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;
        // If this redirect was for calendar scope, store the token
        if (token && result.user) {
          const scopes = (credential as { scope?: string })?.scope ?? "";
          if (scopes.includes("calendar")) {
            const expiry = new Date(Date.now() + 55 * 60 * 1000).toISOString();
            await updateDoc(doc(db, "users", result.user.uid), {
              googleCalendarToken: token,
              googleCalendarTokenExpiry: expiry,
            });
            setGoogleCalendarToken(token);
            setGoogleCalendarConnected(true);
          }
        }
      }
    }).catch(() => {
      // Redirect result errors are non-fatal (e.g. no pending redirect)
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const fid = await ensureUserDoc(firebaseUser);
        setFamilyId(fid);

        // Restore Google Calendar token if still valid
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.googleCalendarToken && data.googleCalendarTokenExpiry) {
            if (new Date(data.googleCalendarTokenExpiry) > new Date()) {
              setGoogleCalendarToken(data.googleCalendarToken);
              setGoogleCalendarConnected(true);
            }
          }
        }
      } else {
        setUser(null);
        setFamilyId(null);
        setGoogleCalendarToken(null);
        setGoogleCalendarConnected(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      // Try popup first (works on desktop); fall back to redirect on mobile/PWA
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        throw err;
      }
    }
  };

  const connectGoogleCalendar = async () => {
    if (!user) return;
    const calProvider = new GoogleAuthProvider();
    calProvider.addScope("https://www.googleapis.com/auth/calendar.events");
    calProvider.setCustomParameters({ prompt: "consent" });

    try {
      const result = await signInWithPopup(auth, calProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (token) {
        const expiry = new Date(Date.now() + 55 * 60 * 1000).toISOString();
        await updateDoc(doc(db, "users", user.uid), {
          googleCalendarToken: token,
          googleCalendarTokenExpiry: expiry,
        });
        setGoogleCalendarToken(token);
        setGoogleCalendarConnected(true);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        // Fall back to redirect for calendar connect on mobile
        await signInWithRedirect(auth, calProvider);
      } else {
        throw err;
      }
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), {
      googleCalendarToken: null,
      googleCalendarTokenExpiry: null,
    });
    setGoogleCalendarToken(null);
    setGoogleCalendarConnected(false);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{
      user, familyId, loading,
      googleCalendarToken, googleCalendarConnected,
      signInWithGoogle, signOut,
      connectGoogleCalendar, disconnectGoogleCalendar,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
