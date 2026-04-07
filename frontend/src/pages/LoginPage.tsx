import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Animated mock dashboard preview
function DashboardPreview() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const bars = [72, 58, 84, 91, 63, 77, 88, 55, 79, 95, 68, 82];
  const animatedBars = bars.map((_v, i) => {
    const offset = (tick + i) % bars.length;
    return bars[offset];
  });

  const stats = [
    { label: "Doses Tracked", value: "2.4M", change: "+12%", color: "text-emerald-400" },
    { label: "Cold Chain OK", value: "98.7%", change: "+0.3%", color: "text-blue-400" },
    { label: "Facilities", value: "1,240", change: "+8", color: "text-violet-400" },
  ];

  return (
    <div className="w-full h-full rounded-xl overflow-hidden bg-gray-900 border border-gray-700 shadow-2xl select-none">
      {/* Mock browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <div className="ml-2 flex-1 bg-gray-700 rounded text-[10px] text-gray-400 px-2 py-0.5 truncate">
          vaxaivision.com/dashboard
        </div>
      </div>

      {/* Mock sidebar + content */}
      <div className="flex h-[calc(100%-32px)]">
        {/* Sidebar */}
        <div className="w-12 bg-gray-800 border-r border-gray-700 flex flex-col items-center pt-3 gap-3">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold">V</div>
          {["▤", "◈", "⊞", "◎", "❄"].map((icon, i) => (
            <div key={i} className={`w-7 h-7 rounded-md flex items-center justify-center text-xs ${i === 0 ? "bg-blue-600/20 text-blue-400" : "text-gray-500 hover:text-gray-300"}`}>
              {icon}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-3 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-white text-xs font-semibold">Operations Overview</div>
              <div className="text-gray-500 text-[10px]">Live · Updated just now</div>
            </div>
            <div className="flex gap-1">
              <div className="px-2 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Live</div>
              <div className="px-2 py-0.5 rounded text-[9px] bg-gray-700 text-gray-400">Export</div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-gray-800 rounded-lg p-2 border border-gray-700">
                <div className="text-[9px] text-gray-400 mb-0.5">{s.label}</div>
                <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[9px] text-emerald-400">{s.change}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-gray-800 rounded-lg p-2 border border-gray-700 mb-2">
            <div className="text-[9px] text-gray-400 mb-2">Vaccination Coverage — Last 12 Months</div>
            <div className="flex items-end gap-1 h-16">
              {animatedBars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-blue-500/70 transition-all duration-1000"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Alert row */}
          <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
            <div className="text-[9px] text-gray-400 mb-1.5">Recent Alerts</div>
            <div className="space-y-1">
              {[
                { color: "bg-emerald-500", text: "All cold chain sensors nominal", time: "2m ago" },
                { color: "bg-yellow-500", text: "Low stock: OPV — Kano State", time: "18m ago" },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${a.color} flex-shrink-0`} />
                  <div className="text-[9px] text-gray-300 flex-1 truncate">{a.text}</div>
                  <div className="text-[9px] text-gray-500">{a.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DEMO_EMAIL = "demo@vaxaivision.com";
const DEMO_PASSWORD = "Demo1234!";

export default function LoginPage() {
  const { login, loading, error, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isAuthenticated) navigate("/");
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  const handleDemoAccess = async () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    await login(DEMO_EMAIL, DEMO_PASSWORD);
  };

  return (
    <div className="min-h-screen flex bg-gray-950">
      {/* Left — product preview panel */}
      <div className="hidden lg:flex flex-col flex-1 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 p-12 justify-between">
        <div>
          <div className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              V
            </div>
            <span className="text-white text-xl font-semibold">VaxAI Vision</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 leading-tight">
            AI-powered vaccine supply<br />chain intelligence
          </h1>
          <p className="text-blue-200/70 text-base mb-8 max-w-sm">
            Real-time forecasting, cold chain monitoring, and geospatial coverage
            maps — built for healthcare enterprises and public health teams.
          </p>
          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mb-10">
            {["Live inventory tracking", "Cold chain alerts", "AI demand forecasting", "Coverage maps"].map((f) => (
              <span key={f} className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs border border-white/10">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Animated dashboard preview */}
        <div className="flex-1 max-h-80 flex items-end">
          <DashboardPreview />
        </div>
      </div>

      {/* Right — login panel */}
      <div className="flex flex-col items-center justify-center w-full lg:w-[440px] lg:flex-shrink-0 bg-white p-8">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">V</div>
          <span className="text-lg font-semibold">VaxAI Vision</span>
        </div>

        <Card className="w-full max-w-sm shadow-none border-0 lg:shadow-sm lg:border">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <p className="text-sm text-muted-foreground">
              Access the vaccine supply chain dashboard
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Demo CTA */}
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs text-blue-700 font-medium mb-2">
                Want to explore first? Try the live demo.
              </p>
              <Button
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                onClick={handleDemoAccess}
                disabled={loading}
              >
                {loading ? "Signing in…" : "▶  Try Live Demo"}
              </Button>
              <p className="text-[10px] text-blue-500/80 mt-1.5 text-center">
                Pre-loaded with sample data · No sign-up required
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">or sign in</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
