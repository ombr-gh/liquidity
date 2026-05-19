import { LiquidChromeLogo } from '../../src'
import logo from './assets/logo.svg';

export default function App() {
  return (
    <div className="app">
      <h1>Liquidity Example App</h1>
      <LiquidChromeLogo svg={logo} size={240} speed={0.25} noiseIntensity={0} scale={4} dotFactor={1.2} dotMultiplier={0.02} vOffset={5} intensityFactor={0.5} expFactor={0.1} redFactor={3} greenFactor={3} blueFactor={3} colorShift={0} logoInteractStrength={0.02} />
      <p>Test React app for local development.</p>
    </div>
  )
}
