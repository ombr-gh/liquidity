# Liquidity

[![CodeQL Advanced](https://github.com/ayphr/liquidity/actions/workflows/codeql.yml/badge.svg)](https://github.com/ayphr/liquidity/actions/workflows/codeql.yml)

A small React + TypeScript library for rendering a liquid chrome logo effect from a transparent SVG source.

## Install

```bash
npm install liquidity-react react react-dom
```

## Usage

```tsx
import { LiquidChromeLogo } from 'liquidity-react';

export function HeroLogo() {
  return (
    <LiquidChromeLogo
      svg={`
        <svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 20h50v80H30z" fill="#fff" />
          <path d="M110 20h70v20h-25v60h-20V40h-25z" fill="#fff" />
        </svg>
      `}
      size={{ width: 720, height: 360 }}
      logoScale={1.05}
      logoInteractStrength={0.45}
    />
  );
}
```

## Notes

- The component expects the SVG itself to contain the final transparent shape.
- SVG input is rasterized to a centered texture before being fed into the shader.
