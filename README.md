# English AI Reading Assistant

英文内容智能翻译助手，使用 Next.js + React + Tailwind CSS + OpenAI API。

## 功能

- 粘贴英文内容后分析
- 商品翻译、资料总结、网页理解、邮件理解、截图识别
- 网页理解模式支持粘贴 http/https 链接并提取页面文字
- 上传图片后识别英文并翻译总结
- 上传 PDF 后提取文字并翻译总结
- 手机端可打开相机，点击拍照后自动识别，不需要再点提交按钮
- 一键复制中文结果
- API Key 只放在后端环境变量中，不暴露到前端

## 本地运行

新建 `.env.local`：

```txt
OPENAI_API_KEY=你的 OpenAI API Key
OPENAI_MODEL=gpt-4.1-mini
```

安装并启动：

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 部署

部署到 Vercel、Railway 或其他 Node.js 平台时，需要在环境变量里配置：

```txt
OPENAI_API_KEY=你的 OpenAI API Key
OPENAI_MODEL=gpt-4.1-mini
```
