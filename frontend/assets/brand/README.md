# Quark Drive 品牌资源

品牌命名遵循根目录 [AGENTS.md](../../../AGENTS.md#核心约定)：夸克充能／Quark Drive／クォークチャージ。

`logo.png` 是站点标识的唯一交付源文件（512×512，透明背景），随 UI bundle 发布。图案以游戏内驱劲能量为参考重新绘制，保留倾斜容器、橙色端盖、深灰机身、三角标记和紫蓝圆形核心，使用统一平面色块与深蓝轮廓，不使用金属高光、立体投影或复杂光效。顶栏、页脚与分享卡水印都引用它。

| 文件 | 用途 | 生成方式 |
|---|---|---|
| `favicon-32.png` | 浏览器标签页与收藏栏 | 同一重绘图以 Lanczos 缩放到 32×32，保留透明度 |
| `favicon-96.png` | 高分辨率浏览器图标 | 同一重绘图以 Lanczos 缩放到 96×96，保留透明度 |
| `favicon.ico` | 常规 favicon 与 Chrome 收藏栏回退 | 同源导出 16、32、48、64px；构建同时输出到 `dist/favicon.ico` |
| `apple-touch-icon.png` | iOS 添加到主屏 | 同一重绘图缩放到 180×180，以深色底板承载，由系统裁圆角 |

`frontend/web/index.html` 声明 ICO、两种 PNG favicon 和主屏图标，构建后使用带内容摘要的资源路径。`/favicon.ico` 跟随当前发布且使用 `Cache-Control: no-store`，不回退到 HTML 或空响应。品牌图变更时同步导出上述尺寸，不分别修改图案。原始参考图、生成母版、提示词与辨识度检查留在 `.cache/brand/`。
