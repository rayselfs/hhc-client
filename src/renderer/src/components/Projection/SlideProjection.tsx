import type {
  SlideBackground,
  SlideDocument,
  SlideElement,
  SlideImageElement,
  SlideSize,
  SlideTextElement
} from '@shared/types/slides'

interface SlideProjectionProps {
  document: SlideDocument
  slideIndex: number
  resolvedImageUrls?: Record<string, string>
}

function getPercent(value: number, total: number): string {
  return `${(value / total) * 100}%`
}

function getElementStyle(element: SlideElement, size: SlideSize): React.CSSProperties {
  return {
    position: 'absolute',
    left: getPercent(element.x, size.width),
    top: getPercent(element.y, size.height),
    width: getPercent(element.width, size.width),
    height: getPercent(element.height, size.height),
    opacity: element.opacity,
    transform: `rotate(${element.rotation}deg)`,
    zIndex: element.zIndex
  }
}

function getBackgroundStyle(
  background: SlideBackground,
  resolvedImageUrls: Record<string, string>
): React.CSSProperties {
  if (background.type === 'color') return { backgroundColor: background.color }
  const imageUrl = resolvedImageUrls[background.mediaId]
  if (!imageUrl) return {}
  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: background.fit
  }
}

function TextElement({
  element,
  size
}: {
  element: SlideTextElement
  size: SlideSize
}): React.JSX.Element {
  return (
    <div
      data-testid="slide-text-element"
      style={{
        ...getElementStyle(element, size),
        color: element.style.color,
        fontFamily: element.style.fontFamily,
        fontSize: getPercent(element.style.fontSize, size.height),
        fontWeight: element.style.fontWeight,
        lineHeight: element.style.lineHeight,
        textAlign: element.style.align,
        whiteSpace: 'pre-wrap',
        overflow: 'hidden'
      }}
    >
      {element.text}
    </div>
  )
}

function ImageElement({
  element,
  size,
  resolvedImageUrls
}: {
  element: SlideImageElement
  size: SlideSize
  resolvedImageUrls: Record<string, string>
}): React.JSX.Element {
  const src = resolvedImageUrls[element.mediaId]
  return (
    <div
      data-testid="slide-image-element"
      data-media-id={element.mediaId}
      style={getElementStyle(element, size)}
    >
      {src ? (
        <img
          src={src}
          alt={element.alt}
          className="h-full w-full"
          style={{ objectFit: element.fit }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/10 text-white/40">
          {element.alt || element.mediaId}
        </div>
      )}
    </div>
  )
}

function renderElement(
  element: SlideElement,
  document: SlideDocument,
  resolvedImageUrls: Record<string, string>
): React.JSX.Element {
  if (element.type === 'text') {
    return <TextElement key={element.id} element={element} size={document.size} />
  }
  return (
    <ImageElement
      key={element.id}
      element={element}
      size={document.size}
      resolvedImageUrls={resolvedImageUrls}
    />
  )
}

export default function SlideProjection({
  document,
  slideIndex,
  resolvedImageUrls = {}
}: SlideProjectionProps): React.JSX.Element {
  const slide = document.slides[slideIndex] ?? document.slides[0]
  if (!slide) {
    return <div className="h-screen w-full bg-black" data-testid="slide-projection-empty" />
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      <div
        data-testid="slide-projection"
        className="relative overflow-hidden"
        style={{
          width: '100vw',
          maxHeight: '100vh',
          aspectRatio: `${document.size.width} / ${document.size.height}`,
          ...getBackgroundStyle(slide.background, resolvedImageUrls)
        }}
      >
        {slide.elements.map((element) => renderElement(element, document, resolvedImageUrls))}
      </div>
    </div>
  )
}
