const { clipboard } = require("electron");

module.exports = function (options) {
  options = options || {};
  const watchDelay = options.watchDelay || 1000;
  const shakeTime = options.shakeTime || 0;

  let lastText = clipboard.readText();
  let lastImage = clipboard.readImage();
  let cachedThumb = null;

  if (!lastImage.isEmpty()) {
    try {
      cachedThumb = lastImage.resize({ width: 16, height: 16, quality: "good" }).toPNG();
    } catch (_) {}
  }

  let delayTimeout = null;
  let wasStopped = true; // Initialize to true so the first active tick resets baselines without triggering

  const intervalId = setInterval(() => {
    const stopped = options.stop && options.stop("clip");
    if (stopped) {
      wasStopped = true;
      return;
    }

    if (wasStopped) {
      // Transitioned from stopped to active: Reset baselines without triggering change events
      lastText = clipboard.readText();
      lastImage = clipboard.readImage();
      cachedThumb = null;
      if (!lastImage.isEmpty()) {
        try {
          cachedThumb = lastImage.resize({ width: 16, height: 16, quality: "good" }).toPNG();
        } catch (_) {}
      }
      wasStopped = false;
      return;
    }

    // 1. Check text change
    if (options.onTextChange) {
      const currentText = clipboard.readText();
      // Match the original logic: trigger only if currentText is not empty and has changed
      if (currentText && lastText !== currentText) {
        lastText = currentText;
        if (delayTimeout) clearTimeout(delayTimeout);
        delayTimeout = setTimeout(() => {
          options.onTextChange(currentText);
          delayTimeout = null;
        }, shakeTime);
        return;
      }
    }

    // 2. Check image change
    if (options.onImageChange) {
      const currentImage = clipboard.readImage();
      const currentEmpty = currentImage.isEmpty();
      const cachedEmpty = lastImage.isEmpty();

      if (!currentEmpty) {
        let changed = false;
        let currentThumb = null;

        if (cachedEmpty) {
          changed = true;
        } else {
          const currentSize = currentImage.getSize();
          const cachedSize = lastImage.getSize();
          if (currentSize.width !== cachedSize.width || currentSize.height !== cachedSize.height) {
            changed = true;
          } else {
            try {
              currentThumb = currentImage.resize({ width: 16, height: 16, quality: "good" }).toPNG();
              if (!cachedThumb || !cachedThumb.equals(currentThumb)) {
                changed = true;
              }
            } catch (_) {
              changed = true;
            }
          }
        }

        if (changed) {
          lastImage = currentImage;
          if (!currentThumb) {
            try {
              currentThumb = currentImage.resize({ width: 16, height: 16, quality: "good" }).toPNG();
            } catch (_) {}
          }
          cachedThumb = currentThumb;

          if (delayTimeout) clearTimeout(delayTimeout);
          delayTimeout = setTimeout(() => {
            options.onImageChange(currentImage);
            delayTimeout = null;
          }, shakeTime);
        }
      } else if (!cachedEmpty) {
        lastImage = currentImage;
        cachedThumb = null;
      }
    }
  }, watchDelay);

  return {
    stop: () => clearInterval(intervalId),
  };
};