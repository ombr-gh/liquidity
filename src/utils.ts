import type { LiquidChromeResolvedSize, LiquidChromeRuntimeOptions, LiquidChromeSize, LiquidChromeUniforms } from './types';

const DEFAULT_UNIFORMS: LiquidChromeUniforms = {
  speed: 2.2,
  iterations: 13,
  scale: 0.05,
  dotFactor: 0.1,
  vOffset: 6.4,
  intensityFactor: 0.23,
  expFactor: 0.6,
  redFactor: 0,
  greenFactor: 0,
  blueFactor: 0,
  colorShift: 0,
  dotMultiplier: 0.3,
  noiseIntensity: 4,
  logoOpacity: 1,
  logoScale: 1,
  logoInteractStrength: 0.4,
  logoBlendMode: 0,
};

export function mergeUniforms(overrides?: Partial<LiquidChromeUniforms>): LiquidChromeUniforms {
  return {
    ...DEFAULT_UNIFORMS,
    ...overrides,
  };
}

export function compactUniformOverrides(overrides?: Partial<LiquidChromeUniforms>): Partial<LiquidChromeUniforms> {
  const result: Partial<LiquidChromeUniforms> = {};

  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value !== undefined) {
      result[key as keyof LiquidChromeUniforms] = value;
    }
  }

  return result;
}

export function resolveSize(size?: LiquidChromeSize): LiquidChromeResolvedSize {
  if (typeof size === 'number') {
    return { width: size, height: size };
  }

  if (size && typeof size === 'object') {
    return {
      width: size.width,
      height: size.height,
    };
  }

  return { width: 800, height: 800 };
}

export function resolveRuntimeOptions(options: {
  svg: string;
  size?: LiquidChromeSize;
  textureSize?: number;
  playing?: boolean;
  ariaLabel?: string;
} & Partial<LiquidChromeUniforms>): LiquidChromeRuntimeOptions {
  const { svg, size, textureSize, playing, ariaLabel, ...uniformOverrides } = options;
  const uniforms = mergeUniforms(compactUniformOverrides(uniformOverrides));
  return {
    ...uniforms,
    svg,
    size: resolveSize(size),
    textureSize: textureSize ?? 1024,
    playing: playing ?? true,
    ariaLabel: ariaLabel ?? 'Liquid chrome logo',
  };
}

export function createWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext {
  const gl = canvas.getContext('webgl', {
    antialias: true,
    alpha: true,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });

  if (!gl) {
    throw new Error('WebGL is not supported in this browser.');
  }

  return gl;
}

export function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create shader.');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'Unknown shader compilation error.';
    gl.deleteShader(shader);
    throw new Error(info);
  }

  return shader;
}

export function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  if (!program) {
    throw new Error('Failed to create shader program.');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? 'Unknown program linking error.';
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(info);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

export function createQuadBuffer(gl: WebGLRenderingContext): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error('Failed to create vertex buffer.');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]),
    gl.STATIC_DRAW,
  );

  return buffer;
}

export function createTransparentTexture(gl: WebGLRenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Failed to create texture.');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  return texture;
}

export async function loadSvgImage(svgSource: string): Promise<HTMLImageElement> {
  const isMarkup = svgSource.trim().startsWith('<svg');
  const source = isMarkup
    ? URL.createObjectURL(new Blob([svgSource], { type: 'image/svg+xml' }))
    : svgSource;

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (isMarkup) {
        URL.revokeObjectURL(source);
      }
      resolve(image);
    };
    image.onerror = () => {
      if (isMarkup) {
        URL.revokeObjectURL(source);
      }
      reject(new Error('Failed to load SVG source.'));
    };
    image.src = source;
  });
}

export function createCenteredLogoCanvas(image: HTMLImageElement, targetSize: number): HTMLCanvasElement {
  const naturalWidth = image.naturalWidth || image.width || targetSize;
  const naturalHeight = image.naturalHeight || image.height || targetSize;
  const aspectRatio = naturalWidth / naturalHeight;

  let imageTargetWidth: number;
  let imageTargetHeight: number;

  if (naturalWidth >= naturalHeight) {
    imageTargetWidth = Math.min(naturalWidth, targetSize);
    imageTargetHeight = Math.round(imageTargetWidth / aspectRatio);
  } else {
    imageTargetHeight = Math.min(naturalHeight, targetSize);
    imageTargetWidth = Math.round(imageTargetHeight * aspectRatio);
  }

  imageTargetWidth = Math.max(4, Math.floor(imageTargetWidth / 4) * 4);
  imageTargetHeight = Math.max(4, Math.floor(imageTargetHeight / 4) * 4);

  const squareSize = Math.max(imageTargetWidth, imageTargetHeight);
  const canvasSize = Math.max(4, Math.ceil(squareSize / 4) * 4);
  const offsetX = Math.floor((canvasSize - imageTargetWidth) / 2);
  const offsetY = Math.floor((canvasSize - imageTargetHeight) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const context = canvas.getContext('2d', {
    alpha: true,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  }) as CanvasRenderingContext2D | null;

  if (!context) {
    throw new Error('Failed to create 2D canvas context.');
  }

  context.clearRect(0, 0, canvasSize, canvasSize);
  context.drawImage(image, offsetX, offsetY, imageTargetWidth, imageTargetHeight);
  return canvas;
}

export function uploadCanvasToTexture(gl: WebGLRenderingContext, texture: WebGLTexture, sourceCanvas: HTMLCanvasElement): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to export PNG image.'));
        return;
      }

      resolve(blob);
    }, 'image/png');
  });
}
