import { File } from 'lucide-react'

type FileProjectionProps = {
  fileName?: string
}

export default function FileProjection({ fileName }: FileProjectionProps): React.JSX.Element {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4 text-center">
        <File className="h-16 w-16 text-white/20" strokeWidth={1.5} />
        <div className="space-y-1">
          <p className="text-white/80 text-2xl font-semibold">File projection — coming soon</p>
          {fileName ? <p className="text-white/30 text-sm">{fileName}</p> : null}
        </div>
      </div>
    </div>
  )
}
