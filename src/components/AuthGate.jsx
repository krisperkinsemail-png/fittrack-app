import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

const AuthContext = createContext({
  session: null,
  signOut: async () => {},
  goToHomepage: () => {},
  returnToApp: () => {},
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
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [showHomepage, setShowHomepage] = useState(false);
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
      setShowHomepage(false);
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

  useEffect(() => {
    if (!session) {
      return;
    }

    setShowHomepage(false);
    setShowAuthForm(false);
    setMessage("");
  }, [session]);

  const authValue = useMemo(
    () => ({
      session,
      signOut: handleSignOut,
      goToHomepage: () => setShowHomepage(true),
      returnToApp: () => setShowHomepage(false),
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

    const response =
      mode === "sign-up"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    const { data, error } = response;

    if (error) {
      setMessage(error.message);
    } else {
      if (data.session) {
        setSession(data.session);
        setShowHomepage(false);
        setShowAuthForm(false);
      }

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
    setShowHomepage(false);
    setMessage("");
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <main className="app-shell">
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AI Fit Cloud</p>
              <h2>Loading session</h2>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!session || showHomepage) {
    if (!showAuthForm) {
      return (
        <main className="app-shell landing-shell">
          <section className="landing-hero card">
            <div className="landing-copy">
              <p className="eyebrow">AI Fit</p>
              <h1 className="landing-title">Track food, training, and scale trend without friction.</h1>
              <p className="landing-text">
                AI Fit gives you one clean mobile dashboard for calories, macros, body weight,
                workouts, and goal progress. Built for fast iPhone use, not spreadsheet energy.
              </p>
              <div className="button-row landing-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    if (session) {
                      setShowHomepage(false);
                      setShowAuthForm(false);
                      setMessage("");
                      return;
                    }

                    setMode("sign-in");
                    setShowAuthForm(true);
                  }}
                >
                  {session ? "Open Dashboard" : "Login / Create Account"}
                </button>
              </div>
            </div>

            <div className="landing-visual-grid" aria-hidden="true">
              <article className="landing-visual-card landing-visual-card--hero">
                <span className="landing-kicker">Today's view</span>
                <strong>1,884 cal</strong>
                <p>Protein 182g • Carbs 201g • Fat 58g</p>
              </article>
              <article className="landing-visual-card">
                <span className="landing-kicker">Weight trend</span>
                <strong>-0.8 lb / week</strong>
                <div className="landing-mini-chart">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </article>
              <article className="landing-visual-card">
                <span className="landing-kicker">Workout flow</span>
                <strong>Push A</strong>
                <p>Rest timer, sets, reps, load, and history in one place.</p>
              </article>
            </div>
          </section>

          <section className="card landing-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">What it does</p>
                <h2>Your daily fitness control panel</h2>
              </div>
              <p className="muted">
                Log quickly, see the signal, and stay consistent without jumping between five apps.
              </p>
            </div>

            <div className="landing-feature-grid">
              <article className="summary-panel">
                <p className="eyebrow">Nutrition</p>
                <strong>Calories + macros</strong>
                <span>Track food entries, reuse saved foods and meals, and compare intake against targets.</span>
              </article>
              <article className="summary-panel">
                <p className="eyebrow">Body weight</p>
                <strong>Trend over noise</strong>
                <span>See actual progress toward your goal with smoothed weight trend and estimated pace.</span>
              </article>
              <article className="summary-panel">
                <p className="eyebrow">Training</p>
                <strong>Structured workouts</strong>
                <span>Run push-pull or custom programs with live set logging and a built-in rest timer.</span>
              </article>
            </div>
          </section>

          <section className="card landing-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Why it works</p>
                <h2>Designed for mobile, not desktop leftovers</h2>
              </div>
            </div>

            <div className="landing-detail-grid">
              <article className="log-card">
                <h3>Less friction, more follow-through</h3>
                <p className="muted">
                  Log meals, workouts, and weigh-ins in seconds so staying on plan feels easy instead of annoying.
                </p>
              </article>
              <article className="log-card">
                <h3>See the truth, not the noise</h3>
                <p className="muted">
                  Your calories, macros, and weight trend all line up in one place so you always know what is actually working.
                </p>
              </article>
              <article className="log-card">
                <h3>Built for real consistency</h3>
                <p className="muted">
                  Whether you are cutting, building, or just trying to stay dialed in, AI Fit helps you stack better days without overthinking it.
                </p>
              </article>
            </div>

            <div className="landing-footer-cta">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (session) {
                    setShowHomepage(false);
                    setShowAuthForm(false);
                    setMessage("");
                    return;
                  }

                  setMode("sign-up");
                  setShowAuthForm(true);
                }}
              >
                {session ? "Back to dashboard" : "Create account"}
              </button>
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className="app-shell">
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AI Fit Cloud</p>
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
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setMessage("");
                setShowAuthForm(false);
                setShowHomepage(Boolean(session));
              }}
            >
              Back
            </button>
          </div>

          {message ? <p className="muted">{message}</p> : null}
        </section>
      </main>
    );
  }

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
}
