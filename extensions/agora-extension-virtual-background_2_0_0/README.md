# agora-extension-virtual-background

Virtual Background enables users to blur their background or replace it with a solid color or an image. This feature is applicable to scenarios such as online conferences, online classes, and live streaming. It helps protect personal privacy and reduces audience distraction.

Virtual Background has the following features:
* Blurred background and image background
* Video/Animated background
* Portrait-in-picture

## Project setup

Take the following steps to set up your project:

1. Refer to the appropriate Quickstart Guide to integrate the Web SDK (v4.10.0 or later) and implement the basic real-time communication functions in your project.

1. Integrate the virtual background extension into your project via npm:

   1. To install the virtual background extension, run the following command :

      ```bash
      npm install agora-extension-virtual-background
      ```

   1. To import the virtual background extension, use any of the following methods:

      Method one: Add the following code to the JavaScript file:
  
      ```javascript
      import VirtualBackgroundExtension from "agora-extension-virtual-background";
      ```

      Method two: Use the Script tag in the HTML file. Once imported, the VirtualBackgroundExtension object can be used directly in JavaScript files.

      ```html
      <script src="./agora-extension-virtual-background.js"></script>
      ```

## Implement virtual background

Integrate the virtual background extension, and implement the virtual background feature, as follows:

1. Register the virtual background extension: After calling AgoraRTC.createClientto create a client object, new a VirtualBackgroundExtension object and pass in the VirtualBackgroundExtension object when calling AgoraRTC.registerExtensions.

    ```javascript
    // Create a client object
    var client = AgoraRTC.createClient({mode: "rtc", codec: "vp9"});
    // Create a VirtualBackgroundExtension instance
    const extension = new VirtualBackgroundExtension();
    // Check browser compatibility virtual background extension
    if (!extension.checkCompatibility()) {
      console.error("Does not support Virtual Background!");
    // Handle exit code
    }
    // Register the extension
    AgoraRTC.registerExtensions([extension]);
    ```

2. Initialize the virtual background extension:

   i. Call extension.createProcessor to create a VirtualBackgroundProcessor instance.

      ```javascript
      processor = extension.createProcessor();
      ```

   ii. Call processor.init to initialize the extension. If resource loading or extension initialization fails, this method throws an exception. Catch this exception, and handle it accordingly.

      ```javascript
      await processor.init();
      ```

   iii. After creating a local camera track, call videoTrack.pipe and videoTrack.processorDestination to inject the extension into the SDK's media processing pipeline.

      ```javascript
      localVideoTrack.pipe(processor).pipe(localVideoTrack.processorDestination);
      ```

1. Call processor.setOptions to choose the virtual background type and make settings. Agora supports the following settings:

   * Set a solid color as the background: Set the type parameter as "color", and set the color parameter.
      ```javascript
      processor.setOptions({type: 'color', color: '#00ff00'});
      ```
   * Set an image as the background: Set the type parameter as "img", and set the source parameter to specify the image object.
      ```javascript
      processor.setOptions({type: 'img', source: HTMLImageElement});
      ```
   * Blur the user's original background: Set the type parameter as "blur" and set the blurDegree parameter to choose the blurring degree, low (1), medium (2), or high (3).
      ```javascript
      processor.setOptions({type: 'blur', blurDegree: 2});
      ```
   * Set a video as the background: Set the type parameter to "video", and then set the source parameter to specify the video object.
      ```javascript
      processor.setOptions({type: 'video', source: HTMLVideoElement});
      ```

1. Call processor.enable to enable the virtual background feature.

   ```javascript
   await processor.enable();
   ```

   If you do not call setOptions before calling this method, the default behavior of the SDK is to blur users' actual background with the blurring degree set as 1. After enabling the virtual background feature, to switch the virtual background type, just call setOptions.

1. Call processor.disable() to temporarily disable the virtual background when needed.

   ```javascript
   await processor.disable()
   ```

1. When the virtual background is no longer used, call videoTrack.unpipe to remove the extension from the current video track.

   ```javascript
   localTracks.videoTrack.unpipe()();
   ```

1. If you need to open the virtual background again, reuse the existing VirtualBackgroundProcessor instance instead of recreating it. If multiple instances are created, it is recommended to call the processor.release method to release the extension resources that are no longer needed.

## Test your implementation
To test your implementation:

1. Add the Sample code to your web project.
1. Call getProcessorInstance() to initialize the processor.
1. Call one of the following methods to set a virtual background:
   * setBackgroundColor
   * setBackgroundBlurring
   * setBackgroundImage

## Sample code

```javascript
import AgoraRTC from "agora-rtc-sdk-ng";
import VirtualBackgroundExtension from "agora-extension-virtual-background";

// Create a client object
var client = AgoraRTC.createClient({mode: "rtc", codec: "vp9"});
// Create a VirtualBackgroundExtension instance
const extension = new VirtualBackgroundExtension();
// Register the extension
AgoraRTC.registerExtensions([extension]);

let processor = null;
var localTracks = {
  videoTrack: null,
  audioTrack: null
};

// Initialization
async function getProcessorInstance() {
  if (!processor && localTracks.videoTrack) {
    // Create a VirtualBackgroundProcessor instance
    processor = extension.createProcessor();

      try {
        // Initialize the extension and pass in the URL of the Wasm file
        await processor.init("./assets/wasms");
        } catch(e) {
          console.log("Fail to load WASM resource!");return null;
          }
    // Inject the extension into the video processing pipeline in the SDK
    localTracks.videoTrack.pipe(processor).pipe(localTracks.videoTrack.processorDestination);
  }
  return processor;
}

// Join a channel
async function join() {
  // Add event listeners
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  [options.uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
    // Join a channel
    client.join(options.appid, options.channel, options.token || null),
    // Create a local microphone track and camera track
    localTracks.audioTrack || AgoraRTC.createMicrophoneAudioTrack(),
    localTracks.videoTrack || AgoraRTC.createCameraVideoTrack({encoderConfig: '720p_4'})
  ]);

  // Play local tracks
  localTracks.videoTrack.play("local-player");
}

// Set a solid color as the background
async function setBackgroundColor() {
  if (localTracks.videoTrack) {
    document.getElementById("loading").style.display = "block";

    let processor = await getProcessorInstance();

    try {
      processor.setOptions({type: 'color', color: '#00ff00'});
      await processor.enable();
    } finally {
      document.getElementById("loading").style.display = "none";
    }

    virtualBackgroundEnabled = true;
  }
}

// Blur the user's actual background
async function setBackgroundBlurring() {
  if (localTracks.videoTrack) {
    document.getElementById("loading").style.display = "block";

    let processor = await getProcessorInstance();

    try {
      processor.setOptions({type: 'blur', blurDegree: 2});
      await processor.enable();
    } finally {
      document.getElementById("loading").style.display = "none";
    }

    virtualBackgroundEnabled = true;
  }
}

// Set an image as the background
async function setBackgroundImage() {
    const imgElement = document.createElement('img');

    imgElement.onload = async() => {
      document.getElementById("loading").style.display = "block";

      let processor = await getProcessorInstance();

      try {
        processor.setOptions({type: 'img', source: imgElement});
        await processor.enable();
      } finally {
        document.getElementById("loading").style.display = "none";
      }

      virtualBackgroundEnabled = true;
    }
    imgElement.src = '/images/background.png';
}
```

## Considerations

* This extension works best when there is only one user in the video captured by the camera.
* The browser support for the virtual background extension is as follows:
* To get a better virtual background experience, Agora recommends using this feature on the latest version of Desktop Chrome.
* Agora does not recommend enabling the virtual background feature on Firefox and Safari browsers. Backgrounding the web app on Firefox may cause the video to freeze, while the performance on Safari could be poor due to the browser's own performance issues.
* Agora does not recommend enabling the virtual background feature on mobile browsers.
* The virtual background feature has high performance requirements. Make sure your computer meets the following requirements:
   * CPU: Intel Core i5 4 cores or higher
   * 8G RAM or more
   * 64-bit operating system
* If multiple extensions are enabled concurrently and other programs are occupying high system resources at the same time, your app may experience audio and video freezes.
* When using this extension, Agora recommends selecting Performance mode or Balanced mode for your laptops. The computing requirements for this extension may not be met if the laptop is in a battery-saving mode.
* This extension supports using a video as a dynamic virtual background since v1.0.0-beta-3. Videos must be in a format supported by `<video>` HTML elements. Agora also recommends meeting the following requirements:
   * The video adopts a resolution close to that of a portrait. Agora recommends not using a video with too high a bit rate.
   * Video content is suitable for looping to achieve a more natural dynamic virtual background effect.
   * Properly reduce the video frame rate, such as 15 fps or below. Video above 30 fps is not recommended by Agora.