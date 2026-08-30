# VLC packaged fixtures

These fixed fixtures exercise the packaged native-video boundary without depending on encoders in
the bundled LGPL FFmpeg runtime.

They were generated on macOS arm64 with FFmpeg 8.1.2:

```bash
ffmpeg -f lavfi -i testsrc2=size=320x180:rate=15 \
  -f lavfi -i sine=frequency=440:sample_rate=48000 -t 8 \
  -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p \
  -c:a aac -b:a 64k -shortest -movflags +faststart healthy.mp4
ffmpeg -i healthy.mp4 -map 0 -c copy -f matroska healthy.mkv
cp healthy.mkv broken-cues-readable.mkv
truncate -s 192579 broken-cues-readable.mkv
cp healthy.mkv unreadable-truncated.mkv
truncate -s 4000 unreadable-truncated.mkv
```

The audio track makes queued volume controls observable on Windows, where libVLC reports zero when
no audio output exists. The broken-cues fixture ends exactly where the actual Cues element begins.
Its SeekHead still references Cues and both Clusters remain readable. The unreadable fixture ends
inside the first Cluster before FFmpeg can decode a complete frame. `manifest.json` is the canonical
byte and behavior contract.
