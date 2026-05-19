import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { LiquidChromeRenderer } from './renderer';
import type { LiquidChromeHandle, LiquidChromeProps } from './types';

export const LiquidChromeLogo = forwardRef<LiquidChromeHandle, LiquidChromeProps>(function LiquidChromeLogo(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<LiquidChromeRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const renderer = new LiquidChromeRenderer(canvas, props);
    rendererRef.current = renderer;
    renderer.start();

    void renderer.setSvg(props.svg);

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.update(props);
  }, [
    props.svg,
    props.size,
    props.textureSize,
    props.playing,
    props.speed,
    props.iterations,
    props.scale,
    props.dotFactor,
    props.vOffset,
    props.intensityFactor,
    props.expFactor,
    props.redFactor,
    props.greenFactor,
    props.blueFactor,
    props.colorShift,
    props.dotMultiplier,
    props.noiseIntensity,
    props.logoOpacity,
    props.logoScale,
    props.logoInteractStrength,
    props.logoBlendMode,
    props.ariaLabel,
  ]);

  useImperativeHandle(
    ref,
    () =>
      rendererRef.current?.getHandle() ?? {
        redraw: () => undefined,
        refreshLogo: async () => undefined,
        exportPng: async () => new Blob(),
        getCanvas: () => canvasRef.current,
      },
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      className={props.className}
      style={{
        display: 'block',
        maxWidth: '100%',
        height: 'auto',
        ...props.style,
      }}
      aria-label={props.ariaLabel ?? 'Liquid chrome logo'}
    />
  );
});
