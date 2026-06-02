import OpenAI from "openai";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const modeInstructions = {
  product: [
    "你是商品介绍助手。",
    "只输出中文，不要复述英文原文，不要写“识别到的英文”。",
    "如果是商品图、包装、标签、价格牌、说明页或配方表，请先判断商品是什么，再给普通人能看懂的介绍。",
    "输出顺序：商品介绍、主要用途、适合人群、怎么使用、配方/成分翻译、健康不健康、价格和值不值、优点、注意事项。",
    "如果没有配方、价格或商品描述，就写“图片里没有看到”。不要编造。"
  ].join(" "),
  summary: [
    "你是资料总结助手。",
    "只输出中文，不要复述英文原文，不要写“识别到的英文”。",
    "用户给的是照片、截图或文件。先总结，再给详细翻译。",
    "输出顺序：重点总结、这份资料主要讲什么、需要做什么、需要注意什么、详细中文翻译。",
    "语言要简单，像给普通人解释。"
  ].join(" "),
  imageTranslate: [
    "你是图片翻译助手。",
    "只输出中文，不要复述英文原文，不要写“识别到的英文”。",
    "用户给的是照片、截图或文件。先完整翻译，再总结。",
    "输出顺序：中文翻译、重点总结、需要注意的地方。",
    "翻译要尽量完整，保留数字、日期、价格、剂量、单位和限制条件。"
  ].join(" "),
  homework: [
    "你是题目解答助手。",
    "只输出中文，不要复述英文原文，不要写“识别到的英文”。",
    "用户给的可能是题目照片、截图、文件，也可能是直接输入的题目或补充要求。先把题目翻译成中文，再解答，再讲解思路。",
    "输出顺序：题目中文翻译、答案、解题步骤、简单讲解、容易错的地方。",
    "如果题目图片不清楚或缺少条件，要先说明缺少什么，再给能判断的部分。"
  ].join(" "),
  calorie: [
    "你是卡路里查询助手。",
    "只输出中文，不要复述英文原文，不要写“识别到的英文”。",
    "用户给的可能是食物照片、菜单、包装、营养标签，也可能是直接输入的食物名称或补充要求。请估算食物名称、份量、卡路里和营养情况。",
    "输出顺序：食物判断、估计份量、估计卡路里、主要营养、减脂/控糖/健身建议、注意事项。",
    "卡路里必须说明是估算值。如果图片里有营养标签或重量，请优先按标签和重量计算。"
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
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const parsed = await pdfParse(buffer);
          extractedText = parsed.text.trim();
        } catch (error) {
          console.error("PDF parse failed", error);
          return Response.json(
            { ok: false, error: "这个 PDF 暂时读不到文字。可能是扫描件或图片 PDF，请改成截图/照片上传。" },
            { status: 400 }
          );
        }

        if (!extractedText) {
          return Response.json(
            { ok: false, error: "这个 PDF 里没有读取到文字。可能是扫描件，请改成截图/照片上传。" },
            { status: 400 }
          );
        }
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

    if (isHttpUrl(text)) {
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
          "先读取图片中的文字和商品/文件信息，但不要输出英文原文。",
          modeInstructions[mode],
          "如果图片内容很少，请根据可见信息谨慎说明，不要编造看不见的信息。"
        ].join("\n")
      : modeInstructions[mode];

    const content = [
      {
        type: "text",
        text: [
          instruction,
          "请保留重要数字、日期、费用、限制条件和专有名词。",
          "输出只使用中文，不要提供英文原文摘录。",
          combinedText ? `用户提供内容：\n${combinedText}` : "用户提供了一张图片，请读取内容后按当前功能输出中文。"
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
  return ["product", "summary", "imageTranslate", "homework", "calorie"].includes(mode)
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
