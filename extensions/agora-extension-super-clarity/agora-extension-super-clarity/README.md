# Agora Video Super Clarity

This package provides video super clarity feature for Agora Web SDK.

## Requirements

- Agora Web SDK (v4.16.1 or later)

## Usage

Install packages `agora-rtc-sdk-ng` and `agora-extension-super-clarity`, then import these packages in your code.

```typescript
import AgoraRTC from "agora-rtc-sdk-ng";
import { SuperClarityExtension, SuperClarityEvents } from "agora-extension-super-clarity";
import type { ISCProcessor } from "agora-extension-super-clarity";
```

Create an extension instance and register it.

```typescript
const extension = new SuperClarityExtension();
AgoraRTC.registerExtensions([extension]);
```

Once you have a video `track` (`ILocalVideoTrack` or `IRemoteVideoTrack`), create a processor and pipe it to `track`.

```typescript
const processor = extension.createProcessor();
processor.on(SuperClarityEvents.ERROR, (msg) => {
  console.error("processor error", msg);
});
processor.on(SuperClarityEvents.FIRST_VIDEO_FRAME, (msg) => {
  console.log("processor first video frame", msg);
});
processor.on(SuperClarityEvents.SKIPFRAME, (msg) => {
  console.warning("processor skip one frame", msg);
});
processor.on(SuperClarityEvents.STATS, (msg) => {
  console.log("processor stats info", msg);
});

track.pipe(processor).pipe(track.processorDestination);
```

Enable or disable the processor.

```typescript
const enable = async () => {
  const enabled = processor.enabled;
  if (!enabled) {
    await processor.enable();
  }
};
const disable = async () => {
  const enabled = processor.enabled;
  if (enabled) {
    await processor.disable();
  }
};
```

Unpipe and release the processor when it is not longer in use.

```typescript
const release = async () => {
  processor.unpipe();
  track.unpipe();
  track.pipe(track.processorDestination);
  await processor.release();
}
```

Refer to [Agora Docs](https://docs.agora.io/) for further details.

---

&copy; Copyright Agora, Inc.
