(function () {
  'use strict';

  // ========== 1. 保存所有原生 API 引用 ==========
  const originalRPiP = HTMLVideoElement.prototype.requestPictureInPicture;
  const originalExit = Document.prototype.exitPictureInPicture;
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
  const originalSetAttribute = Element.prototype.setAttribute;
  const originalPause = HTMLMediaElement.prototype.pause;
  const originalPlay = HTMLMediaElement.prototype.play;

  // ========== 2. 锁定 PiP API，防止网站覆盖 ==========
  Object.defineProperty(HTMLVideoElement.prototype, 'requestPictureInPicture', {
    value: originalRPiP,
    writable: false,
    configurable: false
  });

  Object.defineProperty(Document.prototype, 'exitPictureInPicture', {
    value: originalExit,
    writable: false,
    configurable: false
  });

  // ========== 3. 强制 disablePictureInPicture 始终为 false ==========
  Object.defineProperty(HTMLVideoElement.prototype, 'disablePictureInPicture', {
    get() { return false; },
    set() {},
    configurable: false
  });

  Element.prototype.setAttribute = function (name, value) {
    if (name.toLowerCase() === 'disablepictureinpicture') return;
    return originalSetAttribute.call(this, name, value);
  };

  // ========== 4. 完全屏蔽 PiP 相关事件监听（核心反检测） ==========
  const blockedPiPEvents = new Set([
    'enterpictureinpicture',
    'leavepictureinpicture'
  ]);

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (blockedPiPEvents.has(type)) {
      return; // 完全吞掉，不注册
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  // 同时拦截 on 属性赋值
  const videoProto = HTMLVideoElement.prototype;
  const pipEventProps = ['onenterpictureinpicture', 'onleavepictureinpicture'];
  pipEventProps.forEach(prop => {
    try {
      Object.defineProperty(videoProto, prop, {
        get() { return null; },
        set() {},
        configurable: false
      });
    } catch (e) {}
  });

  // ========== 5. 伪装 document.pictureInPictureElement 为 null ==========
  // 让播放器的轮询检测认为没有进入画中画
  let pipCloakEnabled = false;

  const pictureInPictureElementDesc = Object.getOwnPropertyDescriptor(
    Document.prototype, 'pictureInPictureElement'
  ) || Object.getOwnPropertyDescriptor(
    document, 'pictureInPictureElement'
  );

  if (pictureInPictureElementDesc && pictureInPictureElementDesc.get) {
    const originalGetter = pictureInPictureElementDesc.get;
    Object.defineProperty(Document.prototype, 'pictureInPictureElement', {
      get() {
        if (pipCloakEnabled) return null;
        return originalGetter.call(this);
      },
      configurable: false
    });
  }

  // pictureInPictureEnabled 保持为 true（某些播放器会检查是否支持 PiP）
  try {
    Object.defineProperty(Document.prototype, 'pictureInPictureEnabled', {
      get() { return true; },
      configurable: false
    });
  } catch (e) {}

  // ========== 6. 在 PiP 切换期间保护视频不被暂停 ==========
  let pauseBlocked = false;

  HTMLMediaElement.prototype.pause = function () {
    if (pauseBlocked) return;
    return originalPause.call(this);
  };

  // ========== 7. 暴露控制接口给 content script ==========
  // content script 通过 CustomEvent 与 inject.js 通信
  window.addEventListener('__force_pip_activate', () => {
    pipCloakEnabled = true;
    pauseBlocked = true;

    // 5 秒后解除暂停保护（给足切换时间）
    setTimeout(() => { pauseBlocked = false; }, 5000);
  });

  window.addEventListener('__force_pip_cloak_off', () => {
    pipCloakEnabled = false;
    pauseBlocked = false;
  });

  // ========== 8. 拦截可能的定时器检测 ==========
  // 某些播放器用 setInterval 轮询 pictureInPictureElement
  // 上面已经通过伪装 getter 解决，这里做额外防护

  const originalSetInterval = window.setInterval;
  const originalSetTimeout = window.setTimeout;

  // 拦截包含 PiP 检测的定时器回调（仅针对字符串形式）
  window.setInterval = function (fn, delay, ...args) {
    if (typeof fn === 'string' && fn.includes('pictureInPicture')) {
      return originalSetInterval.call(this, () => {}, delay);
    }
    return originalSetInterval.call(this, fn, delay, ...args);
  };

  window.setTimeout = function (fn, delay, ...args) {
    if (typeof fn === 'string' && fn.includes('pictureInPicture')) {
      return originalSetTimeout.call(this, () => {}, delay);
    }
    return originalSetTimeout.call(this, fn, delay, ...args);
  };

})();
