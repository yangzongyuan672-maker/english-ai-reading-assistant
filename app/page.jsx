"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const modes = [
  { id: "product", label: "商品翻译", hint: "商品标题、描述、参数、评论" },
  { id: "summary", label: "资料总结", hint: "文章、通知、说明书、资料" },
  { id: "webpage", label: "网页理解", hint: "网页文字或链接内容" },
  { id: "email", label: "邮件理解", hint: "英文邮件和回复建议" },
  { id: "image", label: "截图识别", hint: "截图、照片、PDF" }
];

const examples = {
  product: "Paste an English product title, description, specs or reviews here...",
  summary: "Paste an English article, school notice, document or PDF text here...",
  webpage: "Paste English webpage content or a link here...",
  email: "Paste the English email here...",
  image: "Upload a screenshot, take a photo, or add extra notes here..."
};

export default function Home() {
  const [mode, setMode] = useState("product");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [copyText, setCopyText] = useState("复制结果");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const activeMode = useMemo(
    () => modes.find((item) => item.id === mode) || modes[0],
    [mode]
  );

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function analyze(nextMode = mode, nextFile = file) {
    if (busy) return;
    if (!text.trim() && !nextFile) {
      setStatus("请先粘贴英文内容，或上传/拍摄图片。");
      return;
    }

    setBusy(true);
    setStatus(nextFile ? "正在识别和翻译..." : "正在分析英文内容...");
    setResult("");

    try {
      const formData = new FormData();
      formData.append("mode", nextMode);
      formData.append("text", text);
      if (nextFile) formData.append("file", nextFile);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "分析失败");
      setResult(data.result);
      setStatus("完成");
    } catch (error) {
      setStatus(error.message || "分析失败，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopyText("已复制");
    window.setTimeout(() => setCopyText("复制结果"), 1200);
  }

  async function openCamera() {
    try {
      setStatus("正在打开相机...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setStatus("对准英文内容，点击拍照识别。");
    } catch {
      setStatus("无法打开相机，请检查浏览器相机权限。");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function captureAndAnalyze() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatus("拍照失败，请再试一次。");
        return;
      }
      const photo = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
      setMode("image");
      setFile(photo);
      stopCamera();
      await analyze("image", photo);
    }, "image/jpeg", 0.92);
  }

  function onFileChange(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setMode(selected.type.startsWith("image/") ? "image" : mode);
    setFile(selected);
    setStatus(`${selected.name} 已选择，可以开始分析。`);
  }

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="glass rounded-[8px] border border-white/70 p-5 shadow-soft sm:p-6">
          <div className="mb-5">
            <p className="text-sm font-semibold text-slate-600">英文内容智能翻译助手</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">
              English AI Reading Assistant
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-700">
              粘贴英文、上传截图/PDF，或直接用相机拍照。系统会自动翻译、总结，并用简单中文解释重点。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={`min-h-[72px] rounded-[8px] border px-3 py-3 text-left transition ${
                  mode === item.id
                    ? "border-ink bg-ink text-white"
                    : "border-slate-200 bg-white/82 text-ink hover:border-slate-400"
                }`}
              >
                <span className="block text-base font-extrabold">{item.label}</span>
                <span className={`mt-1 block text-xs leading-5 ${mode === item.id ? "text-white/72" : "text-slate-500"}`}>
                  {item.hint}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[8px] border border-slate-200 bg-white/88 p-3">
            <label className="mb-2 block text-sm font-bold text-slate-700">
              当前模式：{activeMode.label}
            </label>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={examples[mode]}
              className="h-48 w-full resize-none rounded-[8px] border border-slate-200 bg-white p-4 text-base leading-7 text-ink placeholder:text-slate-400"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="flex min-h-[48px] cursor-pointer items-center justify-center rounded-[8px] border border-slate-300 bg-white px-4 text-sm font-extrabold">
              上传图片/PDF
              <input
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={onFileChange}
              />
            </label>
            <button
              type="button"
              onClick={cameraOpen ? captureAndAnalyze : openCamera}
              className="min-h-[48px] rounded-[8px] bg-slate-900 px-4 text-sm font-extrabold text-white"
            >
              {cameraOpen ? "拍照识别" : "打开相机"}
            </button>
            <button
              type="button"
              onClick={() => analyze()}
              disabled={busy}
              className="min-h-[48px] rounded-[8px] bg-blue-600 px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {busy ? "处理中..." : mode === "product" ? "商品翻译" : mode === "summary" ? "资料总结" : "开始分析"}
            </button>
          </div>

          {cameraOpen && (
            <div className="mt-4 overflow-hidden rounded-[8px] border border-slate-300 bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
            </div>
          )}

          {(file || preview) && (
            <div className="mt-4 rounded-[8px] border border-slate-200 bg-white/82 p-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{file?.name}</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="shrink-0 rounded-[8px] bg-slate-100 px-3 py-2 font-bold text-slate-700"
                >
                  清除
                </button>
              </div>
              {preview && <img src={preview} alt="上传预览" className="mt-3 max-h-64 w-full rounded-[8px] object-contain" />}
            </div>
          )}

          {status && <p className="mt-4 min-h-6 text-sm font-semibold text-slate-700">{status}</p>}
        </section>

        <section className="glass rounded-[8px] border border-white/70 p-5 shadow-soft sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-600">中文结果</p>
              <h2 className="text-2xl font-black">翻译与解释</h2>
            </div>
            <button
              type="button"
              onClick={copyResult}
              disabled={!result}
              className="min-h-[42px] rounded-[8px] bg-ink px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {copyText}
            </button>
          </div>

          <div className="min-h-[520px] whitespace-pre-wrap rounded-[8px] border border-slate-200 bg-white/90 p-4 text-base leading-8 text-ink">
            {result || (
              <div className="grid h-full place-items-center text-center text-slate-500">
                <p>
                  结果会显示在这里。
                  <br />
                  内容会按栏目整理，方便复制给自己或家人看。
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
