import { Output, BufferTarget, WebMOutputFormat, Mp4OutputFormat, EncodedVideoPacketSource, EncodedPacket } from "mediabunny"
export async function videoFixture(seconds: number, format: "webm" | "mp4" = "webm") {
  const target = new BufferTarget()
  const output = new Output({ format: format === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat(), target })
  const source = new EncodedVideoPacketSource(format === "webm" ? "vp8" : "avc")
  output.addVideoTrack(source, { frameRate: 1 })
  await output.start()
  for (let i = 0; i < seconds; i++) {
    await source.add(new EncodedPacket(new Uint8Array([0x10,0,0,0x9d,1,0x2a,16,0,16,0]), "key", i, 1), { decoderConfig: { codec: format === "webm" ? "vp8" : "avc1.42001e", codedWidth: 16, codedHeight: 16, ...(format === "mp4" ? { description: new Uint8Array([1,66,0,30,255,224,0]) } : {}) } })
  }
  await output.finalize()
  return new Blob([target.buffer!], { type: `video/${format}` })
}
