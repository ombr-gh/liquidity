import { fragmentShaderSource, vertexShaderSource } from './shaders';
import type { LiquidChromeHandle, LiquidChromeProps, LiquidChromeRuntimeOptions, LiquidChromeUniforms } from './types';
import {
  canvasToPngBlob,
  createCenteredLogoCanvas,
  createProgram,
  createQuadBuffer,
  createTransparentTexture,
  createWebGLContext,
  loadSvgImage,
  resolveRuntimeOptions,
  uploadCanvasToTexture,
} from './utils';

const MAX_TEXTURE_SIZE = 1536;

function resolveUniformOverrideProps(props: Partial<LiquidChromeUniforms>): Partial<LiquidChromeUniforms> {
  return {
    speed: props.speed,
    iterations: props.iterations,
    scale: props.scale,
    dotFactor: props.dotFactor,
    vOffset: props.vOffset,
    intensityFactor: props.intensityFactor,
    expFactor: props.expFactor,
    redFactor: props.redFactor,
    greenFactor: props.greenFactor,
    blueFactor: props.blueFactor,
    colorShift: props.colorShift,
    dotMultiplier: props.dotMultiplier,
    noiseIntensity: props.noiseIntensity,
    logoOpacity: props.logoOpacity,
    logoScale: props.logoScale,
    logoInteractStrength: props.logoInteractStrength,
    logoBlendMode: props.logoBlendMode,
  };
}

export class LiquidChromeRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly positionBuffer: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private readonly uniformLocations: {
    resolution: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    speed: WebGLUniformLocation | null;
    iterations: WebGLUniformLocation | null;
    scale: WebGLUniformLocation | null;
    dotFactor: WebGLUniformLocation | null;
    vOffset: WebGLUniformLocation | null;
    intensityFactor: WebGLUniformLocation | null;
    expFactor: WebGLUniformLocation | null;
    colorFactors: WebGLUniformLocation | null;
    colorShift: WebGLUniformLocation | null;
    dotMultiplier: WebGLUniformLocation | null;
    noiseIntensity: WebGLUniformLocation | null;
    logoTexture: WebGLUniformLocation | null;
    logoOpacity: WebGLUniformLocation | null;
    logoScale: WebGLUniformLocation | null;
    logoAspectRatio: WebGLUniformLocation | null;
    logoInteractStrength: WebGLUniformLocation | null;
    logoBlendMode: WebGLUniformLocation | null;
  };
  private options: LiquidChromeRuntimeOptions;
  private logoAspectRatio = 1;
  private animationFrameId = 0;
  private destroyed = false;
  private startTime = performance.now();
  private pausedTime = 0;
  private currentTime = 0;
  private loadToken = 0;
  private ready = false;

  constructor(canvas: HTMLCanvasElement, props: LiquidChromeProps) {
    this.canvas = canvas;
    this.gl = createWebGLContext(canvas);
    this.program = createProgram(this.gl, vertexShaderSource, fragmentShaderSource);
    this.positionBuffer = createQuadBuffer(this.gl);
    this.texture = createTransparentTexture(this.gl);
    this.uniformLocations = {
      resolution: this.gl.getUniformLocation(this.program, 'u_resolution'),
      time: this.gl.getUniformLocation(this.program, 'u_time'),
      speed: this.gl.getUniformLocation(this.program, 'u_speed'),
      iterations: this.gl.getUniformLocation(this.program, 'u_iterations'),
      scale: this.gl.getUniformLocation(this.program, 'u_scale'),
      dotFactor: this.gl.getUniformLocation(this.program, 'u_dotFactor'),
      vOffset: this.gl.getUniformLocation(this.program, 'u_vOffset'),
      intensityFactor: this.gl.getUniformLocation(this.program, 'u_intensityFactor'),
      expFactor: this.gl.getUniformLocation(this.program, 'u_expFactor'),
      colorFactors: this.gl.getUniformLocation(this.program, 'u_colorFactors'),
      colorShift: this.gl.getUniformLocation(this.program, 'u_colorShift'),
      dotMultiplier: this.gl.getUniformLocation(this.program, 'u_dotMultiplier'),
      noiseIntensity: this.gl.getUniformLocation(this.program, 'u_noiseIntensity'),
      logoTexture: this.gl.getUniformLocation(this.program, 'u_logoTexture'),
      logoOpacity: this.gl.getUniformLocation(this.program, 'u_logoOpacity'),
      logoScale: this.gl.getUniformLocation(this.program, 'u_logoScale'),
      logoAspectRatio: this.gl.getUniformLocation(this.program, 'u_logoAspectRatio'),
      logoInteractStrength: this.gl.getUniformLocation(this.program, 'u_logoInteractStrength'),
      logoBlendMode: this.gl.getUniformLocation(this.program, 'u_logoBlendMode'),
    };

    this.options = resolveRuntimeOptions({
      svg: props.svg,
      size: props.size,
      textureSize: props.textureSize,
      playing: props.playing,
      ariaLabel: props.ariaLabel,
      ...resolveUniformOverrideProps(props),
    });

    this.resize(this.options.size.width, this.options.size.height);
    this.setPlaying(this.options.playing);
  }

  getCanvas() {
    return this.canvas;
  }

  getHandle(): LiquidChromeHandle {
    return {
      redraw: () => {
        this.renderFrame();
      },
      refreshLogo: async (svg?: string) => {
        await this.setSvg(svg ?? this.options.svg);
      },
      exportPng: async (fileName?: string) => {
        const blob = await canvasToPngBlob(this.canvas);
        if (fileName && typeof document !== 'undefined') {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
        }
        return blob;
      },
      getCanvas: () => this.canvas,
    };
  }

  async setSvg(svg: string): Promise<void> {
    this.options = {
      ...this.options,
      svg,
    };

    const token = ++this.loadToken;
    const image = await loadSvgImage(svg);
    if (this.destroyed || token !== this.loadToken) {
      return;
    }

    this.logoAspectRatio = (image.naturalWidth || image.width) / (image.naturalHeight || image.height || 1);
    const textureSize = Math.max(4, Math.min(MAX_TEXTURE_SIZE, this.options.textureSize));
    const centeredCanvas = createCenteredLogoCanvas(image, textureSize);
    uploadCanvasToTexture(this.gl, this.texture, centeredCanvas);
    this.ready = true;
    this.renderFrame();
  }

  setPlaying(playing: boolean): void {
    if (playing === this.options.playing) {
      return;
    }

    if (playing) {
      this.startTime = performance.now() - this.pausedTime;
    } else {
      this.pausedTime = this.currentTime;
    }

    this.options = {
      ...this.options,
      playing,
    };
  }

  update(props: LiquidChromeProps): void {
    const nextOptions = resolveRuntimeOptions({
      svg: props.svg,
      size: props.size,
      textureSize: props.textureSize,
      playing: props.playing ?? this.options.playing,
      ariaLabel: props.ariaLabel ?? this.options.ariaLabel,
      ...resolveUniformOverrideProps(props),
    });

    this.options = nextOptions;
    this.resize(nextOptions.size.width, nextOptions.size.height);
    this.setPlaying(nextOptions.playing);

    if (props.svg !== undefined && props.svg !== '') {
      void this.setSvg(props.svg);
    }
  }

  start(): void {
    if (this.animationFrameId !== 0) {
      return;
    }

    const animate = () => {
      if (this.destroyed) {
        return;
      }

      this.animationFrameId = globalThis.requestAnimationFrame(animate);
      this.renderFrame();
    };

    this.animationFrameId = globalThis.requestAnimationFrame(animate);
  }

  stop(): void {
    if (this.animationFrameId !== 0) {
      globalThis.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.gl.deleteTexture(this.texture);
    this.gl.deleteBuffer(this.positionBuffer);
    this.gl.deleteProgram(this.program);
  }

  resize(width: number, height: number): void {
    const dpr = Math.max(1, Math.min(globalThis.devicePixelRatio || 1, 2));
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.gl.viewport(0, 0, pixelWidth, pixelHeight);
  }

  private renderFrame(): void {
    if (this.destroyed) {
      return;
    }

    const now = performance.now();
    if (this.options.playing) {
      this.currentTime = now - this.startTime;
    }

    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.useProgram(this.program);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

    const positionLocation = this.gl.getAttribLocation(this.program, 'aVertexPosition');
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(positionLocation);

    const uniforms = this.options;
    if (this.uniformLocations.resolution) {
      this.gl.uniform2f(this.uniformLocations.resolution, this.canvas.width, this.canvas.height);
    }
    if (this.uniformLocations.time) {
      this.gl.uniform1f(this.uniformLocations.time, this.currentTime / 1000);
    }
    if (this.uniformLocations.speed) {
      this.gl.uniform1f(this.uniformLocations.speed, uniforms.speed);
    }
    if (this.uniformLocations.iterations) {
      this.gl.uniform1f(this.uniformLocations.iterations, uniforms.iterations);
    }
    if (this.uniformLocations.scale) {
      this.gl.uniform1f(this.uniformLocations.scale, uniforms.scale);
    }
    if (this.uniformLocations.dotFactor) {
      this.gl.uniform1f(this.uniformLocations.dotFactor, uniforms.dotFactor);
    }
    if (this.uniformLocations.vOffset) {
      this.gl.uniform1f(this.uniformLocations.vOffset, uniforms.vOffset);
    }
    if (this.uniformLocations.intensityFactor) {
      this.gl.uniform1f(this.uniformLocations.intensityFactor, uniforms.intensityFactor);
    }
    if (this.uniformLocations.expFactor) {
      this.gl.uniform1f(this.uniformLocations.expFactor, uniforms.expFactor);
    }
    if (this.uniformLocations.colorFactors) {
      this.gl.uniform3f(this.uniformLocations.colorFactors, uniforms.redFactor, uniforms.greenFactor, uniforms.blueFactor);
    }
    if (this.uniformLocations.colorShift) {
      this.gl.uniform1f(this.uniformLocations.colorShift, uniforms.colorShift);
    }
    if (this.uniformLocations.dotMultiplier) {
      this.gl.uniform1f(this.uniformLocations.dotMultiplier, uniforms.dotMultiplier);
    }
    if (this.uniformLocations.noiseIntensity) {
      this.gl.uniform1f(this.uniformLocations.noiseIntensity, uniforms.noiseIntensity);
    }

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    if (this.uniformLocations.logoTexture) {
      this.gl.uniform1i(this.uniformLocations.logoTexture, 0);
    }
    if (this.uniformLocations.logoOpacity) {
      this.gl.uniform1f(this.uniformLocations.logoOpacity, uniforms.logoOpacity);
    }
    if (this.uniformLocations.logoScale) {
      this.gl.uniform1f(this.uniformLocations.logoScale, uniforms.logoScale);
    }
    if (this.uniformLocations.logoAspectRatio) {
      this.gl.uniform1f(this.uniformLocations.logoAspectRatio, this.logoAspectRatio);
    }
    if (this.uniformLocations.logoInteractStrength) {
      this.gl.uniform1f(this.uniformLocations.logoInteractStrength, uniforms.logoInteractStrength);
    }
    if (this.uniformLocations.logoBlendMode) {
      this.gl.uniform1i(this.uniformLocations.logoBlendMode, uniforms.logoBlendMode);
    }

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
}
