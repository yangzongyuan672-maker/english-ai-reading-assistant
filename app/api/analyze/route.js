import OpenAI from "openai";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const modeInstructions = {
  product: [
    "你是英文商品翻译助手。",
    "输出中文，语言简单易懂，适合普通中文用户。",
    "按这些栏目输出：中文名、商品作用、核心功能、适合人群、使用方法、优点、注意事项、简短介绍。",
    "如果内容缺失，基于原文谨慎说明，不要编造具体参数。"
  ].join(" "),
  summary: [
    "你是英文资料翻译总结助手。",
    "输出中文，语言简单易懂。",
    "按这些栏目输出：中文翻译、重点总结、这份资料主要讲、你需要做的事、需要注意什么、简单解释。",
    "重点总结用编号列表。"
  ].join(" "),
  webpage: [
    "你是英文网页内容理解助手。",
    "输出中文，语言简单易懂。",
    "按这些栏目输出：中文翻译、网页主要内容、重点信息、费用/日期/限制、需要注意的地方。"
  ].join(" "),
  email: [
    "你是英文邮件理解助手。",
    "输出中文，语言简单易懂。",
    "按这些栏目输出：中文翻译、对方想表达什么、是否需要回复、建议怎么回复、可复制英文回复模板。",
    "英文回复模板要礼貌、简短、可直接复制。"
  ].join(" "),
  image: [
    "你是截图识别和英文内容理解助手。",
    "先识别图片中的英文内容，再输出中文。",
    "按这些栏目输出：识别到的英文、中文翻译、重点总结、主要内容、需要注意什么、简单解释。"
  ].join(" ")
};

export async function POST(request) {
  try {
    if (!openai) {
      return Response.json(
        { ok: false, error: "OPENAI_API_KEY 还没有配置。请在 .env.local 里设置后重启服务。" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const mode = normalizeMode(formData.get("mode"));
    const text = String(formData.get("text") || "").trim();
    const file = formData.get("file");

    let extractedText = "";
    let webpageText = "";
    let imagePart = null;

    if (file instanceof File && file.size > 0) {
      if (file.type === "application/pdf") {
        const buffer = Buffer.from(await file.arrayBuffer());
        const parsed = await pdfParse(buffer);
        extractedText = parsed.text.trim();
      } else if (file.type.startsWith("image/")) {
        const dataUrl = await fileToDataUrl(file);
        imagePart = { type: "image_url", image_url: { url: dataUrl } };
      } else {
        return Response.json(
          { ok: false, error: "目前支持图片和 PDF 文件。" },
          { status: 400 }
        );
      }
    }

    if (mode === "webpage" && isHttpUrl(text)) {
      webpageText = await extractWebpageText(text);
    }

    const combinedText = [
      text,
      webpageText ? `网页提取内容：\n${webpageText}` : "",
      extractedText
    ].filter(Boolean).join("\n\n");
    if (!combinedText && !imagePart) {
      return Response.json(
        { ok: false, error: "请先粘贴英文内容，或上传图片/PDF。" },
        { status: 400 }
      );
    }

    const instruction = imagePart
      ? [
          "先识别图片中的英文内容。",
          modeInstructions[mode],
          "如果图片里不是所选模式的内容，就按最接近的方式翻译、总结和解释。"
        ].join("\n")
      : modeInstructions[mode];

    const content = [
      {
        type: "text",
        text: [
          instruction,
          "请保留重要数字、日期、费用、限制条件和专有名词。",
          "输出只使用中文为主，除了英文回复模板和原文摘录。",
          combinedText ? `用户提供内容：\n${combinedText}` : "用户提供了一张图片，请识别图片中的英文内容。"
        ].join("\n\n")
      }
    ];

    if (imagePart) content.push(imagePart);

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "你是 English AI Reading Assistant，帮助中文用户理解英文内容。回答要清楚、直接、可复制。"
        },
        { role: "user", content }
      ]
    });

    const result = completion.choices?.[0]?.message?.content?.trim();
    return Response.json({ ok: true, result: result || "没有生成结果，请再试一次。" });
  } catch (error) {
    console.error(error);
    return Response.json(
      { ok: false, error: "识别或分析失败，请稍后重试。" },
      { status: 500 }
    );
  }
}

function normalizeMode(mode) {
  return ["product", "summary", "webpage", "email", "image"].includes(mode)
    ? mode
    : "summary";
}

async function fileToDataUrl(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !isBlockedHost(url.hostname);
  } catch {
    return false;
  }
}

function isBlockedHost(hostname) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "127.0.0.1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

async function extractWebpageText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "EnglishAIReadingAssistant/1.0"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) return "";
  const html = await response.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50000);
}
