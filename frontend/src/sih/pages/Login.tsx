import { useState } from "react";
import { Lock, Sun, Moon, Loader2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { BrandMark, BrandWordmark, InstitutionBadge } from "../components/common/Logo";
import { GoogleGlyph } from "../components/common/GoogleGlyph";

export default function Login() {
  const { signIn, signingIn } = useAuth();
  const { theme, toggle } = useTheme();
  const [ssoLoading, setSsoLoading] = useState(false);

  return (
    <div className="flex min-h-screen w-full" style={{ background: "var(--bg-canvas)" }}>
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        className="fixed right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          color: "var(--text-secondary)",
        }}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div
        className="relative hidden w-[42%] flex-col justify-between overflow-hidden px-12 py-14 lg:flex"
        style={{ background: "var(--brand-900)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <BrandMark size={30} />
          <BrandWordmark className="text-xl text-white" />
        </div>

        <div className="relative max-w-sm">
          <h1 className="text-2xl font-semibold leading-snug text-white">
            The on-premises AI workbench.
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--brand-200)" }}>
            Nothing you do here leaves the plant network.
          </p>
        </div>

        <div className="relative flex items-center gap-2.5 text-xs" style={{ color: "var(--brand-300)" }}>
          <InstitutionBadge />
          Refinery operations - on-premises
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-14">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark size={26} />
            <BrandWordmark className="text-lg" style={{ color: "var(--text-primary)" }} />
          </div>

          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Sign in to the workbench
          </h2>

          <button
            onClick={() => signIn()}
            disabled={signingIn || ssoLoading}
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-70"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-strong)",
              color: "var(--text-primary)",
            }}
          >
            {signingIn ? <Loader2 size={16} className="animate-spin" /> : <GoogleGlyph size={17} />}
            {signingIn ? "Signing in" : "Sign in with Google"}
          </button>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>or</span>
            <span className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
          </div>

          <button
            onClick={() => {
              setSsoLoading(true);
              setTimeout(() => signIn(), 700);
            }}
            disabled={signingIn || ssoLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-70"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          >
            {ssoLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={14} />}
            Continue with company SSO
          </button>

          <p className="mt-6 text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            Access is logged and restricted to authorized personnel.
          </p>
        </div>
      </div>
    </div>
  );
}
