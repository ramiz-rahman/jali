# Licences

What Trips ships that someone else made, and the licence it ships under. Each photo's own author, licence and source page are on the photo (its ⓘ) and in `src/trip/photos.ts`.

| What                                                    | Licence                   | File                                                                                     |
| ------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| Figtree, the text face (`@fontsource-variable/figtree`) | SIL Open Font License 1.1 | `figtree-OFL.txt`                                                                        |
| Bricolage Grotesque, the display face                   | SIL Open Font License 1.1 | `bricolage-grotesque-OFL.txt`                                                            |
| MapLibre GL JS, the map                                 | BSD 3-Clause              | `maplibre-gl-LICENSE.txt`                                                                |
| Photos in `public/photos`, from Wikimedia Commons       | CC0 1.0                   | `cc0-1.0-legalcode.txt`                                                                  |
|                                                         | CC BY 2.0, 3.0 and 4.0    | `cc-by-2.0-legalcode.txt`, `cc-by-3.0-legalcode.txt`, `cc-by-4.0-legalcode.txt`          |
|                                                         | CC BY-SA 2.0, 3.0 and 4.0 | `cc-by-sa-2.0-legalcode.txt`, `cc-by-sa-3.0-legalcode.txt`, `cc-by-sa-4.0-legalcode.txt` |

The map's tiles and data are fetched, not shipped: [OpenFreeMap](https://openfreemap.org), with data © OpenMapTiles and © OpenStreetMap contributors under the [Open Database License](https://www.openstreetmap.org/copyright), credited on the map at all times.

The Creative Commons legal codes are as published at creativecommons.org (the 2.0 codes, published only as web pages, reduced to their text). The photos are resized and saved as WebP for the app (`scripts/photos.mjs`), and cropped on screen to fit their frame; nothing else in them is changed.
