import { lazy, Suspense, useEffect, useState } from "react";

const ShaderGradientLayer = lazy(() =>
  import("@shadergradient/react").then(({ ShaderGradientCanvas, ShaderGradient }) => ({
    default: function ShaderGradientLayer() {
      return (
        <ShaderGradientCanvas
          pointerEvents="none"
          style={{ width: "100%", height: "100%" }}
          pixelDensity={1}
          fov={45}
          powerPreference="high-performance"
        >
          <ShaderGradient
            type="waterPlane"
            animate="on"
            uSpeed={0.18}
            uStrength={1.8}
            uDensity={1.25}
            uFrequency={5.5}
            uAmplitude={0.32}
            color1="#042f2e"
            color2="#059669"
            color3="#d97706"
            reflection={0.35}
            grain="on"
            grainBlending={0.16}
          />
        </ShaderGradientCanvas>
      );
    }
  }))
);

export function AmbientShaderBackground() {
  const [allowWebGl, setAllowWebGl] = useState(false);

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
      setAllowWebGl(Boolean(context));
    } catch {
      setAllowWebGl(false);
    }
  }, []);

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
      <div
        data-testid="ambient-fallback"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1000px 520px at 78% -12%, rgba(5,150,105,0.22), transparent 68%), radial-gradient(780px 420px at 18% -8%, rgba(4,47,46,0.34), transparent 72%), radial-gradient(520px 280px at 62% 72%, rgba(217,119,6,0.07), transparent 72%), linear-gradient(145deg, #05080b 0%, #07090d 55%, #06090b 100%)"
        }}
      />
      {allowWebGl && (
        <Suspense fallback={null}>
          <div className="absolute inset-0">
            <ShaderGradientLayer />
          </div>
        </Suspense>
      )}
      <div className="absolute inset-0 bg-[#05080b]/65" />
    </div>
  );
}
