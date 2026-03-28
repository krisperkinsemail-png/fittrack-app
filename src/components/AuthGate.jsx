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
            <div className="button-row landing-top-actions">
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
                Open Dashboard
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setMode("sign-in");
                  setShowAuthForm(true);
                }}
              >
                Sign In / Create Account
              </button>
            </div>

            <div className="landing-hero-top" aria-hidden="true">
              <article className="landing-logo-stage">
                <img
                  className="landing-hero-image"
                  src="/homepageimage.png"
                  alt="AI Fit neon logo with flexing figure"
                />
              </article>
            </div>

            <div className="landing-copy">
              <h1 className="landing-title">Built for the version of you that actually follows through.</h1>
              <p className="landing-text">
                Track nutrition, macros, scale trend, and workouts in one dark, fast, high-signal
                system. No spreadsheet feel. No bloated fitness-app clutter.
              </p>
              <div className="landing-pill-row" aria-label="Core features">
                <span className="landing-pill">Nutrition</span>
                <span className="landing-pill">Macros</span>
                <span className="landing-pill">Weight</span>
                <span className="landing-pill">Workouts</span>
              </div>
            </div>

            <div className="landing-visual-grid" aria-hidden="true">
              <div className="landing-neon-metrics">
                <article className="landing-neon-card">
                  <div className="landing-neon-card__header">
                    <span className="landing-kicker">Daily target lock</span>
                    <strong>1,884 cal</strong>
                  </div>
                  <p>Protein 182g • Carbs 201g • Fat 58g</p>
                </article>
                <article className="landing-neon-card">
                  <div className="landing-neon-card__header">
                    <span className="landing-kicker">Weight trend</span>
                    <strong>-0.8 lb / week</strong>
                  </div>
                  <div className="landing-mini-chart">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </article>
                <article className="landing-neon-card">
                  <div className="landing-neon-card__header">
                    <span className="landing-kicker">Workout flow</span>
                    <strong>Push A</strong>
                  </div>
                  <p>Rest timer, sets, reps, load, and history side by side.</p>
                </article>
              </div>
            </div>
          </section>

          <section className="card landing-section landing-section--accent">
            <div className="section-heading">
              <div>
                <p className="eyebrow">What it does</p>
                <h2>Everything you need to stay on track in one place.</h2>
              </div>
              <p className="muted">
                Instead of bouncing between notes, spreadsheets, and different apps, you can manage the whole day here.
              </p>
            </div>

            <div className="landing-feature-grid">
              <article className="summary-panel landing-feature-panel">
                <p className="eyebrow">Nutrition</p>
                <strong>Log meals fast and keep your macros tight</strong>
                <span>Track calories and macros with quick search, saved foods, meals, and restaurant options.</span>
              </article>
              <article className="summary-panel landing-feature-panel">
                <p className="eyebrow">Body weight</p>
                <strong>Know whether your body weight is actually moving</strong>
                <span>See trend data instead of getting thrown off by one random weigh-in.</span>
              </article>
              <article className="summary-panel landing-feature-panel">
                <p className="eyebrow">Training</p>
                <strong>Train with more structure and better feedback</strong>
                <span>Log workouts, track sets and load, and compare against what you did last time.</span>
              </article>
            </div>
          </section>

          <section className="card landing-section landing-section--dark">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Why it works</p>
                <h2>Built to help you stay consistent when motivation is not enough.</h2>
              </div>
            </div>

            <div className="landing-detail-grid">
              <article className="log-card">
                <h3>Hit your targets without overthinking it</h3>
                <p className="muted">
                  When logging is quick and the numbers are clear, it is easier to stay locked in day after day.
                </p>
              </article>
              <article className="log-card">
                <h3>See what is working faster</h3>
                <p className="muted">
                  Your food, scale trend, and workouts live in one place, so you can connect your habits to your results.
                </p>
              </article>
              <article className="log-card">
                <h3>Keep momentum when life gets busy</h3>
                <p className="muted">
                  The easier it is to log a meal, a lift, or a weigh-in, the less likely you are to fall off when the day gets crowded.
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
