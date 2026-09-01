/** Client-safe validation limits shared by the UI and the server pipeline. */
export const DETECTION_LIMITS = {
  minTextLength: 80,
  maxTextLength: 20000,
  maxImageBytes: 10 * 1024 * 1024,
  maxVideoBytes: 100 * 1024 * 1024,
  imageTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  videoTypes: ["video/mp4", "video/quicktime", "video/webm"],
  /** Frames sampled in the browser and sent to the server for inference. */
  videoFrameSamples: 8,
  frameMaxEdge: 640,
  /** Rate limits per signed-in user. */
  requestsPerHour: 20,
  mediaRequestsPerHour: 8,
} as const;

export const MAGIC_BYTES: { type: string; test: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    type: "image/webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/** Content-based sniffing: the extension and MIME header are never trusted alone. */
export function sniffImageType(bytes: Uint8Array): string | null {
  for (const entry of MAGIC_BYTES) if (entry.test(bytes)) return entry.type;
  return null;
}

export class DetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DetectionError";
  }
}
