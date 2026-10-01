import { lazy, Suspense } from 'react';
import type { Theme } from '../theme/useTheme';
import type { WorldId } from './worlds';

// The WebGL layers are loaded only by the worlds that use them.
const Particles = lazy(() => import('../reactbits/Particles'));
const Aurora = lazy(() => import('../reactbits/Aurora'));
const DotGrid = lazy(() => import('../reactbits/DotGrid'));

interface Props {
  world: Exclude<WorldId, 'atlas'>;
  theme: Theme;
  /** No moving layers: reduced motion, or the appearance studio is set to Off or Still. */
  still: boolean;
}

/** What sits behind the page in each world. Atlas draws its own contour map, so it never comes here. */
export function WorldBackdrop({ world, theme, still }: Props) {
  const dark = theme === 'dark';
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {world === 'jarvis' && (
        <div className="jarvis-bg absolute inset-0">
          {!still && dark && (
            <Suspense fallback={null}>
              <Particles className="absolute inset-0" particleCount={150} particleSpread={11} speed={0.045} particleColors={['#33e6ff', '#7bf0ff', '#ffffff']} moveParticlesOnHover particleHoverFactor={0.6} alphaParticles particleBaseSize={70} sizeRandomness={1} cameraDistance={22} />
            </Suspense>
          )}
          {!still && <div className="jarvis-scan" />}
        </div>
      )}
      {world === 'valley' && (
        <div className="absolute inset-0 bg-os-bg">
          <Suspense fallback={null}>
            {!still && <DotGrid dotSize={3} gap={26} baseColor={dark ? '#262626' : '#e2e0da'} activeColor={dark ? '#ededed' : '#0a0a0a'} proximity={110} shockRadius={180} shockStrength={3} resistance={900} returnDuration={1.4} />}
          </Suspense>
        </div>
      )}
      {world === 'cyber' && <div className="absolute inset-0 bg-os-bg" />}
      {world === 'rack' && <div className="rack-bg absolute inset-0" />}
      {world === 'abyss' && (
        <div className="absolute inset-0 bg-os-bg">
          <div
            className="absolute inset-0"
            style={{ background: dark ? 'radial-gradient(ellipse 90% 60% at 50% 110%, rgba(20,120,130,0.4), transparent 70%), linear-gradient(#020a0f, #03161d 70%, #04222a)' : 'linear-gradient(#e6f7f6, #c4e8e8)' }}
          />
          {!still && (
            <Suspense fallback={null}>
              <div className="absolute inset-x-0 top-0 h-[70%] opacity-70">
                <Aurora colorStops={dark ? ['#0e7c86', '#5cf2d6', '#1f4fa8'] : ['#7fe0d2', '#bff5ee', '#8fc5ee']} amplitude={0.9} blend={0.7} speed={0.5} lightMode={!dark} />
              </div>
              {dark && <Particles className="absolute inset-0" particleCount={90} particleSpread={10} speed={0.03} particleColors={['#5cf2d6', '#9afff0', '#ffffff']} alphaParticles particleBaseSize={60} sizeRandomness={1.4} cameraDistance={24} disableRotation />}
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}
