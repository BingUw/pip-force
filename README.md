# Force PiP - 强制画中画 Chrome 扩展

一款 Chrome 扩展，可在任何网站上强制启用画中画（Picture-in-Picture）功能，即使网站主动禁用了画中画也能正常使用。

## 功能特性

- 自动检测页面中动态加载的视频元素
- 移除网站设置的 `disablePictureInPicture` 限制
- 拦截网站对画中画 API 的篡改和事件检测
- 伪装画中画状态，绕过播放器的反画中画检测机制
- 支持 JWPlayer 等第三方播放器
- 支持 Shadow DOM 和同源 iframe 中的视频

## 安装方法

1. 下载或克隆本项目到本地
2. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions/` 并回车
3. 打开右上角的 **「开发者模式」** 开关
4. 点击左上角 **「加载已解压的扩展程序」**
5. 选择本项目文件夹（`pip-force`）
6. 安装完成

## 使用方法

### 方式一：浮动按钮

当页面中检测到视频时，页面右下角会自动出现一个蓝色圆形按钮，点击即可进入画中画模式。

### 方式二：快捷键

按 `Alt + P` 一键切换画中画。

### 方式三：扩展弹窗

点击 Chrome 工具栏上的扩展图标，然后点击「切换画中画」按钮。

## 项目结构

```
pip-force/
├── manifest.json   # 扩展配置文件
├── inject.js       # 页面上下文注入脚本（拦截网站的反画中画检测）
├── content.js      # Content Script（视频检测与画中画控制）
├── background.js   # Service Worker（快捷键监听）
├── popup.html      # 扩展弹窗界面
├── popup.js        # 弹窗交互逻辑
└── icons/          # 扩展图标
```

## 工作原理

1. `inject.js` 在页面脚本之前注入，锁定原生画中画 API 不被网站覆盖
2. 屏蔽所有 `enterpictureinpicture` / `leavepictureinpicture` 事件监听器注册
3. 伪装 `document.pictureInPictureElement` 始终返回 `null`，使播放器的轮询检测失效
4. 在画中画切换期间临时阻止 `video.pause()` 调用
5. 通过 `MutationObserver` 持续监听 DOM 变化，捕获 AJAX 动态加载的视频

## 许可证

MIT
