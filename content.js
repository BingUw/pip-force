(function () {
  'use strict';

  // 在页面上下文中注入 inject.js，先于任何网站脚本运行
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  let pipButton = null;

  function unlockVideo(video) {
    video.removeAttribute('disablepictureinpicture');
    video.removeAttribute('disablePictureInPicture');
    try {
      Object.defineProperty(video, 'disablePictureInPicture', {
        value: false,
        writable: true
      });
    } catch (e) {}
  }

  function findAllVideos() {
    const videos = [];

    document.querySelectorAll('video').forEach(v => videos.push(v));

    document.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) {
        el.shadowRoot.querySelectorAll('video').forEach(v => videos.push(v));
      }
    });

    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc) {
          iframeDoc.querySelectorAll('video').forEach(v => videos.push(v));
        }
      } catch (e) {}
    });

    return videos;
  }

  function getBestVideo() {
    const videos = findAllVideos();
    if (videos.length === 0) return null;

    const playing = videos.filter(v => !v.paused && !v.ended && v.readyState > 2);
    if (playing.length > 0) {
      return playing.reduce((a, b) => (a.duration || 0) > (b.duration || 0) ? a : b);
    }

    const withDuration = videos.filter(v => v.duration > 0);
    if (withDuration.length > 0) {
      return withDuration.reduce((a, b) => (a.duration || 0) > (b.duration || 0) ? a : b);
    }

    return videos[0];
  }

  async function togglePiP() {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      // 退出画中画后关闭伪装
      window.dispatchEvent(new CustomEvent('__force_pip_cloak_off'));
      return;
    }

    const video = getBestVideo();
    if (!video) {
      showToast('未找到视频元素');
      return;
    }

    unlockVideo(video);

    // 通知 inject.js 开启伪装：隐藏 pictureInPictureElement + 阻止 pause
    window.dispatchEvent(new CustomEvent('__force_pip_activate'));

    try {
      await video.requestPictureInPicture();

      // 确保视频继续播放（防止播放器在事件触发前已暂停）
      setTimeout(() => {
        if (video.paused) {
          video.play().catch(() => {});
        }
      }, 500);

      // 监听退出画中画
      video.addEventListener('leavepictureinpicture', function handler() {
        video.removeEventListener('leavepictureinpicture', handler);
        window.dispatchEvent(new CustomEvent('__force_pip_cloak_off'));
      });

    } catch (e) {
      window.dispatchEvent(new CustomEvent('__force_pip_cloak_off'));
      showToast('画中画启动失败: ' + e.message);
    }
  }

  function showToast(message) {
    const toast = document.createElement('div');
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      background: 'rgba(0,0,0,0.8)',
      color: '#fff',
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '14px',
      zIndex: '2147483647',
      fontFamily: 'system-ui, sans-serif',
      transition: 'opacity 0.3s',
      pointerEvents: 'none'
    });
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function createPiPButton() {
    if (pipButton) return;

    pipButton = document.createElement('div');
    pipButton.id = '__force-pip-btn';
    pipButton.title = '画中画 (Alt+P)';
    pipButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="white">' +
      '<path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 ' +
      '1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>';

    Object.assign(pipButton.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: '#1a73e8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      zIndex: '2147483647',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      transition: 'transform 0.2s, background 0.2s',
      userSelect: 'none'
    });

    pipButton.addEventListener('mouseenter', () => {
      pipButton.style.transform = 'scale(1.1)';
      pipButton.style.background = '#1557b0';
    });
    pipButton.addEventListener('mouseleave', () => {
      pipButton.style.transform = 'scale(1)';
      pipButton.style.background = '#1a73e8';
    });

    pipButton.addEventListener('click', togglePiP);
    document.body.appendChild(pipButton);
  }

  function updateButtonVisibility() {
    const videos = findAllVideos();
    const hasVideo = videos.length > 0;

    if (hasVideo && !pipButton) {
      createPiPButton();
    } else if (hasVideo && pipButton) {
      pipButton.style.display = 'flex';
    } else if (!hasVideo && pipButton) {
      pipButton.style.display = 'none';
    }

    videos.forEach(unlockVideo);
  }

  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            if (node.tagName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
              shouldCheck = true;
              break;
            }
          }
        }
      }
      if (shouldCheck) break;
    }
    if (shouldCheck) {
      updateButtonVisibility();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    updateButtonVisibility();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
      updateButtonVisibility();
    });
  }

  setInterval(updateButtonVisibility, 3000);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'toggle-pip') {
      togglePiP();
    }
  });
})();
