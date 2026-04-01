"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Home } from "lucide-react";

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg"
            style={{ background: "var(--primary)" }}>
            <Home className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
              Hussung HQ
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
              Your family command center
            </p>
          </div>
        </div>

        {/* Sign in card */}
        <div className="rounded-2xl border p-8 shadow-sm space-y-4"
          style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Welcome back
          </h2>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Sign in with your Google account to access your family dashboard.
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all hover:opacity-90 active:scale-95"
            style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          For the Hussung family only
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
