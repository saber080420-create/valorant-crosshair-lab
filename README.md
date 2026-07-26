# 准星实验室

一个根据玩家 DPI、操作习惯、颜色反应和动态瞄准测试，生成个性化
VALORANT 准星配置代码的开源网页工具。

在线版本：<https://personal-crosshair-lab.team-3099.chatgpt.site>

## 功能

- DPI、射击习惯、交战距离和视觉偏好配置
- 五轮颜色反应测试
- 20 秒触碰式 Aim Lab 风格瞄准测试，无需点击
- 根据测试结果生成个性化准星参数
- 当前游戏武器分类与枪械适配
- 十字、圆点、空心、小猫和四叶花等造型
- 自定义 HEX 颜色和实时预览
- 生成可复制的 VALORANT 准星配置代码
- 所有测试数据只在浏览器本地计算

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 项目结构

- `app/page.tsx`：测试流程、推荐逻辑、代码生成和页面组件
- `app/globals.css`：视觉设计与响应式样式
- `app/layout.tsx`：站点元数据
- `public/og.png`：社交分享封面

## 游戏内导入

复制生成的代码，在 VALORANT 中依次打开：

`设置 → 准星 → 导入准星配置代码`

准星配置编码并非 Riot Games 公开且永久稳定的 API。游戏更新改变编码格式时，
本项目也需要相应更新。

## 免责声明

本项目是独立玩家工具，与 Riot Games 没有隶属、合作或背书关系。
VALORANT 和相关商标归 Riot Games 所有。

## 许可证

[MIT](LICENSE)
