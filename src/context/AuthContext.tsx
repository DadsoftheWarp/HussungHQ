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
  signInWithPopup,
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleCalendarToken, setGoogleCalendarToken] = useState<string | null>(null);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setFamilyId(data.familyId || firebaseUser.uid);

          // Restore Google Calendar token if still valid
          if (data.googleCalendarToken && data.googleCalendarTokenExpiry) {
            const expiry = new Date(data.googleCalendarTokenExpiry);
            if (expiry > new Date()) {
              setGoogleCalendarToken(data.googleCalendarToken);
              setGoogleCalendarConnected(true);
            } else {
              // Token expired — clear it
              setGoogleCalendarToken(null);
              setGoogleCalendarConnected(false);
            }
          }
        } else {
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
          setFamilyId(newFamilyId);
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
    await signInWithPopup(auth, googleProvider);
  };

  const connectGoogleCalendar = async () => {
    if (!user) return;
    const calProvider = new GoogleAuthProvider();
    calProvider.addScope("https://www.googleapis.com/auth/calendar.events");
    // Force account selection so user can pick the right Google account
    calProvider.setCustomParameters({ prompt: "consent" });

    const result = await signInWithPopup(auth, calProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (token) {
      // Tokens last 1 hour; store with expiry slightly under that
      const expiry = new Date(Date.now() + 55 * 60 * 1000).toISOString();
      await updateDoc(doc(db, "users", user.uid), {
        googleCalendarToken: token,
        googleCalendarTokenExpiry: expiry,
      });
      setGoogleCalendarToken(token);
      setGoogleCalendarConnected(true);
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
