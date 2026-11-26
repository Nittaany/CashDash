const PROVIDER_LABELS = {
  google: "Google",
  github: "GitHub"
};

export function OAuthButtons({ providers = [] }) {
  const enabledProviders = [...new Set(providers)]
    .filter((provider) => Object.hasOwn(PROVIDER_LABELS, provider));

  if (enabledProviders.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="relative flex items-center justify-center">
        <span className="bg-[#0c1017] px-3 text-xs text-slate-500">or continue with</span>
      </div>
      {enabledProviders.map((provider) => (
        <a
          key={provider}
          href={`/api/auth/oauth/${provider}`}
          className="flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-emerald-500/40 hover:bg-white/[0.07]"
        >
          Continue with {PROVIDER_LABELS[provider]}
        </a>
      ))}
    </div>
  );
}
