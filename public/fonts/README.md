# Bundled fonts

These unmodified Latin-subset variable WOFF2 files are checked into the
project. No font downloads, CDN requests, or npm font packages are needed to
build or run RedTeam Demo.

| Family | Use | Distribution | Local file |
| --- | --- | --- | --- |
| Inter | Light headlines and clean body text | `@fontsource-variable/inter@5.3.0` | `inter/files/inter-latin-wght-normal.woff2` |
| Doto | Pixel/dot-matrix numbers, stats, and agent log | `@fontsource-variable/doto@5.3.0` | `doto/files/doto-latin-wght-normal.woff2` |

Both families are licensed under the **SIL Open Font License 1.1**. The
original copyright notices and full license texts are preserved alongside
the fonts in `inter/LICENSE` and `doto/LICENSE`.

Upstream projects:

- Inter: https://github.com/rsms/inter
- Doto: https://github.com/oliverlalan/Doto

SHA-256 checksums of the bundled binaries:

```text
3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62  inter/files/inter-latin-wght-normal.woff2
0e1a84240f323bafc2db7540d303ba17ace1daa8bde2936a76be82d24a7a271b  doto/files/doto-latin-wght-normal.woff2
```

The offline `npm test` command checks these binaries, the local font
declarations and preloads, and the server's WOFF2 responses.
