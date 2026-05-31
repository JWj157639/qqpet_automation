const { clipboard } = require("electron");

module.exports = function (options) {
  options = options || {};
  const watchDelay = options.watchDelay || 1000;  // 改为 1000ms，原 200ms 太频繁
  const shakeTime = options.shakeTime || 0;

  const readThumbnail = (image) => {
    try {
      return image.resize({ width: 16, height: 16, quality: "good" }).toPNG();
    } catch (err) {
      console.warn("Failed to build clipboard thumbnail:", err);
      return null;
    }
  };

  let lastText = "";
  let lastImage = null;
  let cachedThumb = null;

  let delayTimeout = null;
  let wasStopped = true;

  const intervalId = setInterval(() => {
    const stopped = options.stop && options.stop("clip");
    if (stopped) {
      wasStopped = true;
      return;
    }

    if (wasStopped) {
      lastText = clipboard.readText();
      lastImage = clipboard.readImage();
      cachedThumb = lastImage.isEmpty() ? null : readThumbnail(lastImage);
      wasStopped = false;
      return;
    }

    // 1. Check text change
    if (options.onTextChange) {
      const currentText = clipboard.readText();
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

    // 2. Check image change - 使用缩略图比较，避免 toDataURL 阻塞
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
            // 只比较缩略图，避免 toDataURL() 阻塞主线程
            currentThumb = readThumbnail(currentImage);
            if (!cachedThumb || !currentThumb || !cachedThumb.equals(currentThumb)) {
              changed = true;
            }
          }
        }

        if (changed) {
          lastImage = currentImage;
          cachedThumb = currentThumb || readThumbnail(currentImage);

          if (delayTimeout) clearTimeout(delayTimeout);
          delayTimeout = setTimeout(() => {
            // 只传递缩略图 data URL，避免传递大图阻塞
            const thumbData = cachedThumb ? `data:image/png;base64,${cachedThumb.toString("base64")}` : null;
            options.onImageChange(thumbData);
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
    stop: () => clearInterval(intervalId)
  };
};