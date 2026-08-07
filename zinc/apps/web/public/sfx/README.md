# Sample pack (optional)

Drop real recorded sound effects in this folder and the game uses them
automatically, replacing the synthesised fallback. No code change, no rebuild
config — the loader just looks for these names on startup:

| file            | when it plays                          |
| --------------- | -------------------------------------- |
| `tick`          | every tick, ~2×/second — keep it quiet  |
| `shatter`       | 1–3 plates break                       |
| `shatter_many`  | 4+ plates break at once                |
| `extract`       | you cash out                           |
| `died`          | your own plate shatters                |
| `seal`          | the lattice seals, round starts        |
| `join`          | you bond in                            |
| `bonanza`       | the jackpot fires                      |

`.mp3`, `.wav` or `.ogg` — the loader tries each in that order. Anything
missing keeps its synthesised version, so the pack can be filled in one sound
at a time.

Keep files short and normalised: `tick` under ~80ms, the shatters under ~600ms,
`bonanza` up to ~5s (the overlay runs 7s). Mono is fine; the game adds its own
reverb and stereo width on top, so use dry source material.

**Licensing:** only ship sounds cleared for commercial use.
[freesound.org](https://freesound.org) filtered to CC0 is free and safe;
Soundly, A Sound Effect and Krotos sell properly licensed impact/debris packs.
Do not use sounds pulled from other games or from YouTube.
