import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

const AuthContext = createContext({
  session: null,
  signOut: async () => {},
  hasCloud: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState("sign-in");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(hasSupabaseConfig);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        setMessage(error.message);
      } else {
        setSession(data.session);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const authValue = useMemo(
    () => ({
      session,
      signOut: handleSignOut,
      hasCloud: hasSupabaseConfig,
    }),
    [session]
  );

  if (!hasSupabaseConfig) {
    return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
  }

  async function handleMagicLink(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email for the sign-in link.");
    }

    setLoading(false);
  }

  async function handlePasswordAuth(event) {
    event.preventDefault();
    setMessage("");

    if (mode === "sign-up" && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const action =
      mode === "sign-up"
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });

    const { error } = await action;

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        mode === "sign-up"
          ? "Account created. If email confirmation is required, check your inbox."
          : "Signed in."
      );
    }

    setLoading(false);
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password reset email sent.");
    }

    setLoading(false);
  }

  async function handleSignOut() {
    setSession(null);
    setMessage("");
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <main className="app-shell">
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FitTrack Cloud</p>
              <h2>Loading session</h2>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="app-shell">
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FitTrack Cloud</p>
              <h2>
                {mode === "sign-up"
                  ? "Create your account"
                  : mode === "reset"
                    ? "Reset your password"
                    : mode === "magic-link"
                      ? "Email me a sign-in link"
                      : "Sign in to sync your data"}
              </h2>
            </div>
            <p className="muted">
              Use email and password for regular login. Magic link stays available as a fallback.
            </p>
          </div>

          <form
            className="form-grid"
            onSubmit={
              mode === "magic-link"
                ? handleMagicLink
                : mode === "reset"
                  ? handleResetPassword
                  : handlePasswordAuth
            }
          >
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            {mode === "sign-in" || mode === "sign-up" ? (
              <>
                <label>
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    required
                    minLength={6}
                  />
                </label>

                {mode === "sign-up" ? (
                  <label>
                    Confirm password
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter password"
                      required
                      minLength={6}
                    />
                  </label>
                ) : null}
              </>
            ) : null}

            <button type="submit" className="primary-button">
              {mode === "sign-up"
                ? "Create account"
                : mode === "reset"
                  ? "Send reset email"
                  : mode === "magic-link"
                    ? "Email me a magic link"
                    : "Sign in"}
            </button>
          </form>

          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setMode("sign-in")}>
              Sign in
            </button>
            <button type="button" className="secondary-button" onClick={() => setMode("sign-up")}>
              Create account
            </button>
            <button type="button" className="secondary-button" onClick={() => setMode("reset")}>
              Forgot password
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setMode("magic-link")}
            >
              Magic link
            </button>
          </div>

          {message ? <p className="muted">{message}</p> : null}
        </section>
      </main>
    );
  }

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
}
