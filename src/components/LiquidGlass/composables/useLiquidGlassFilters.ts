const FILTERS_ID = 'liquid-glass-filters'

const FILTERS_SVG = `<svg id="${FILTERS_ID}" style="display:none;height:0;width:0;position:absolute">
  <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
    <feTurbulence type="fractalNoise" baseFrequency="0.01 0.01" numOctaves="1" seed="5" result="turbulence"/>
    <feComponentTransfer in="turbulence" result="mapped">
      <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5"/>
      <feFuncG type="gamma" amplitude="0" exponent="1" offset="0"/>
      <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5"/>
    </feComponentTransfer>
    <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap"/>
    <feSpecularLighting in="softMap" surfaceScale="5" specularConstant="1" specularExponent="100" lighting-color="white" result="specLight">
      <fePointLight x="-200" y="-200" z="300"/>
    </feSpecularLighting>
    <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage"/>
    <feDisplacementMap in="SourceGraphic" in2="softMap" scale="150" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="glass-refraction" color-interpolation-filters="linearRGB" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
    <feDisplacementMap in="SourceGraphic" in2="SourceGraphic" scale="20" xChannelSelector="R" yChannelSelector="B" x="0%" y="0%" width="100%" height="100%" result="displacementMap"/>
    <feGaussianBlur stdDeviation="3 3" x="0%" y="0%" width="100%" height="100%" in="displacementMap" edgeMode="none" result="blur"/>
  </filter>
</svg>`

let isInjected = false

export function injectLiquidGlassFilters(): void {
  if (isInjected || typeof document === 'undefined') return
  if (document.getElementById(FILTERS_ID)) {
    isInjected = true
    return
  }

  const container = document.createElement('div')
  container.innerHTML = FILTERS_SVG
  const svg = container.firstElementChild
  if (svg) {
    document.body.appendChild(svg)
    isInjected = true
  }
}

export function useLiquidGlassFilters(): void {
  if (typeof window !== 'undefined') {
    injectLiquidGlassFilters()
  }
}
