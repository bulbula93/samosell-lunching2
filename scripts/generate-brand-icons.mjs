// Deterministic exports of the existing orange logo mark; no generated artwork.
import { readFile, writeFile } from "node:fs/promises"
import sharp from "sharp"

const svg = await readFile(new URL("../app/icon.svg", import.meta.url), "utf8")
const render = (size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()

await writeFile(new URL("../public/favicon-96.png", import.meta.url), await render(96))
await writeFile(new URL("../app/apple-icon.png", import.meta.url), await render(180))
for (const size of [192, 512]) {
  await writeFile(new URL(`../public/pwa-icon-${size}.svg`, import.meta.url),
    svg.replace(/width="256" height="256"/, `width="${size}" height="${size}"`))
}

// ICO directory with lossless PNG frames for modern browsers and crawlers.
const sizes = [16, 32, 48, 96, 256]
const frames = await Promise.all(sizes.map(render))
const directory = Buffer.alloc(6 + 16 * frames.length)
directory.writeUInt16LE(1, 2)
directory.writeUInt16LE(frames.length, 4)
let offset = directory.length
frames.forEach((frame, index) => {
  const entry = 6 + index * 16
  directory[entry] = directory[entry + 1] = sizes[index] === 256 ? 0 : sizes[index]
  directory.writeUInt16LE(1, entry + 4)
  directory.writeUInt16LE(32, entry + 6)
  directory.writeUInt32LE(frame.length, entry + 8)
  directory.writeUInt32LE(offset, entry + 12)
  offset += frame.length
})
await writeFile(new URL("../app/favicon.ico", import.meta.url), Buffer.concat([directory, ...frames]))
console.log("Exported orange brand icons: PNG 96/180, SVG 192/512, ICO 16/32/48/96/256")
