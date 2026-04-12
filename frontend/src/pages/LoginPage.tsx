import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { Globe } from "lucide-react";

function useCountUp(target: number, duration = 1600, started = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!started) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, started]);
  return value;
}

function AnimatedKPIs() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const doses = useCountUp(2400000, 1800, visible);
  const coldChain = useCountUp(987, 1400, visible);
  const facilities = useCountUp(1240, 1600, visible);

  const fmt = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(1)}M`
      : n >= 1000
      ? `${(n / 1000).toFixed(0)}K`
      : n.toString();

  const kpis = [
    {
      value: fmt(doses),
      label: t("login.dosesTracked"),
      change: t("login.thisMonth"),
      color: "from-emerald-400 to-teal-400",
      icon: "💉",
    },
    {
      value: `${(coldChain / 10).toFixed(1)}%`,
      label: t("login.coldChainUptime"),
      change: t("login.vsLastMonth"),
      color: "from-blue-400 to-cyan-400",
      icon: "❄️",
    },
    {
      value: facilities.toLocaleString(),
      label: t("login.facilitiesLabel"),
      change: t("login.thisWeek"),
      color: "from-violet-400 to-purple-400",
      icon: "🏥",
    },
  ];

  return (
    <div ref={ref} className="grid grid-cols-3 gap-3 w-full max-w-lg">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="relative rounded-2xl p-4 text-center"
          style={{
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div className="text-2xl mb-1">{k.icon}</div>
          <div
            className={`text-xl font-extrabold bg-gradient-to-r ${k.color} bg-clip-text text-transparent`}
          >
            {k.value}
          </div>
          <div className="text-white/70 text-[10px] font-medium mt-0.5">{k.label}</div>
          <div className="text-emerald-400 text-[9px] mt-0.5">{k.change}</div>
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const { login, demoLogin, loading, error, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/");
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  const handleDemoAccess = async () => {
    await demoLogin();
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0a1628 0%, #0d2440 35%, #0a3352 60%, #083344 100%)",
      }}
    >
      {/* Background orbs */}
      <div
        className="absolute top-[-120px] left-[-120px] w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, #14b8a6 0%, transparent 70%)" }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5 pointer-events-none"
        style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 60%)" }}
      />

      {/* Language selector */}
      <div className="absolute top-4 end-4 z-20 flex items-center gap-2">
        <Globe className="h-4 w-4 text-white/50" />
        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="text-xs rounded-md px-2 py-1 bg-white/10 text-white/70 border border-white/20"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code} className="text-gray-900">
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Main card */}
      <div
        className="relative z-10 w-full max-w-md mx-4 rounded-3xl px-8 py-10 flex flex-col items-center gap-6"
        style={{
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg"
            style={{
              background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
              boxShadow: "0 8px 24px rgba(37,99,235,0.5)",
            }}
          >
            V
          </div>
          <div className="text-center">
            <h1 className="text-white text-xl font-bold tracking-tight">{t("app.name")}</h1>
            <p className="text-white/50 text-xs mt-0.5">
              {t("app.subtitle")}
            </p>
          </div>
        </div>

        {/* KPI counters */}
        <AnimatedKPIs />

        {/* Demo CTA */}
        <div className="w-full flex flex-col items-center gap-2">
          <button
            onClick={handleDemoAccess}
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-60"
            style={{
              background: loading
                ? "rgba(37,99,235,0.5)"
                : "linear-gradient(135deg, #2563eb, #0ea5e9)",
              boxShadow: loading ? "none" : "0 8px 24px rgba(37,99,235,0.45)",
            }}
          >
            {loading ? t("auth.loadingDemo") : t("auth.tryDemo")}
          </button>
          <p className="text-white/40 text-[10px] text-center">
            {t("auth.demoDataNote")}
          </p>
        </div>

        {/* Divider */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
          <button
            className="text-white/40 text-xs hover:text-white/70 transition-colors px-2"
            onClick={() => setShowSignIn((v) => !v)}
          >
            {showSignIn ? t("auth.hideSignIn") : t("auth.signInWithAccount")}
          </button>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
        </div>

        {/* Sign-in form */}
        {showSignIn && (
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
            <Input
              id="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400"
            />
            <Input
              id="password"
              type="password"
              placeholder={t("auth.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400"
            />
            {error && (
              <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
        )}

        {/* Footer */}
        <p className="text-white/25 text-[10px] text-center">
          {t("auth.securityFooter")}
        </p>
      </div>

      {/* Trust logos row */}
      <div className="relative z-10 mt-6 flex items-center gap-4 text-white/20 text-xs">
        <span>{t("auth.partnersFooter")}</span>
      </div>
    </div>
  );
}
