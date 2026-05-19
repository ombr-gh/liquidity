import type { CSSProperties } from 'react';

export interface LiquidChromeUniforms {
  speed: number;
  iterations: number;
  scale: number;
  dotFactor: number;
  vOffset: number;
  intensityFactor: number;
  expFactor: number;
  redFactor: number;
  greenFactor: number;
  blueFactor: number;
  colorShift: number;
  dotMultiplier: number;
  noiseIntensity: number;
  logoOpacity: number;
  logoScale: number;
  logoInteractStrength: number;
  logoBlendMode: number;
}

export interface LiquidChromeResolvedSize {
  width: number;
  height: number;
}

export type LiquidChromeSize = number | LiquidChromeResolvedSize;

export interface LiquidChromeProps extends Partial<LiquidChromeUniforms> {
  svg: string;
  size?: LiquidChromeSize;
  textureSize?: number;
  playing?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export interface LiquidChromeHandle {
  redraw: () => void;
  refreshLogo: (svg?: string) => Promise<void>;
  exportPng: (fileName?: string) => Promise<Blob>;
  getCanvas: () => HTMLCanvasElement | null;
}

export interface LiquidChromeRuntimeOptions extends LiquidChromeUniforms {
  svg: string;
  size: LiquidChromeResolvedSize;
  textureSize: number;
  playing: boolean;
  ariaLabel: string;
}
