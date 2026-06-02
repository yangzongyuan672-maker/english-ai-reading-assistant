"use client";

import { useEffect, useRef, useState } from "react";

const modes = [
  { id: "summary", label: "资料总结" },
  { id: "imageTranslate", label: "翻译图片" },
  { id: "product", label: "商品介绍" },
  { id: "homework", label: "题目解答" },
  { id: "calorie", label: "卡路里查询" }
];

export default function Home() {
  const [mode, setMode] = useState("summary");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("请选择下方功能");
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preview, setPreview] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  function chooseMode(nextMode) {
    if (busy) return;
    stopCamera();
    setMode(nextMode);
    setSheetOpen(true);
    setStatus("请选择图片、文件，或打开相机");
  }

  function chooseFile() {
    setSheetOpen(false);
    fileInputRef.current?.click();
  }

  async function onFileChange(event) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    showPreview(selected);
    await analyze(selected, mode);
  }

  function showPreview(file) {
    setSelectedName(file.name || "已选择文件");
    if (!file.type.startsWith("image/")) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });
  }

  async function openCamera() {
    try {
      setSheetOpen(false);
      setStatus("相机已打开，对准内容后点拍照");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setStatus("无法打开相机，请检查浏览器相机权限");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function captureAndAnalyze() {
    const video = videoRef.current;
    if (!video || busy) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatus("拍照失败，请再试一次");
        return;
      }
      const photo = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
      showPreview(photo);
      stopCamera();
      await analyze(photo, mode);
    }, "image/jpeg", 0.92);
  }

  async function analyze(file, nextMode) {
    setBusy(true);
    setResult("");
    setStatus("正在识别，请稍等...");

    try {
      const formData = new FormData();
      formData.append("mode", nextMode);
      formData.append("file", file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "分析失败");
      setResult(data.result);
      setStatus("完成");
    } catch (error) {
      setStatus(error.message || "分析失败，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper pb-32 text-ink">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={onFileChange}
      />

      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <p className="text-sm font-bold text-slate-600">{modes.find((item) => item.id === mode)?.label}</p>
          <p className="text-sm font-semibold text-slate-500">{status}</p>
        </div>

        {cameraOpen && (
          <div className="mt-4 overflow-hidden rounded-[8px] bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="aspect-[3/4] w-full object-cover sm:aspect-video" />
            <div className="grid grid-cols-2 gap-2 bg-white p-2">
              <button
                type="button"
                onClick={stopCamera}
                className="min-h-12 rounded-[8px] bg-slate-100 font-bold text-slate-700"
              >
                取消
              </button>
              <button
                type="button"
                onClick={captureAndAnalyze}
                disabled={busy}
                className="min-h-12 rounded-[8px] bg-ink font-bold text-white disabled:bg-slate-400"
              >
                拍照
              </button>
            </div>
          </div>
        )}

        {(preview || selectedName) && !cameraOpen && (
          <div className="mt-4 rounded-[8px] border border-slate-200 bg-white p-3">
            {preview ? (
              <img src={preview} alt="已选择内容" className="max-h-72 w-full rounded-[8px] object-contain" />
            ) : (
              <p className="py-5 text-center font-bold text-slate-600">{selectedName}</p>
            )}
          </div>
        )}

        <article className="mt-4 flex-1 whitespace-pre-wrap rounded-[8px] bg-white p-4 text-[17px] leading-8 shadow-soft">
          {result || (
            <div className="grid min-h-[55vh] place-items-center text-center text-slate-400">
              <p>{busy ? "正在生成中文内容..." : "结果会显示在这里"}</p>
            </div>
          )}
        </article>
      </section>

      {sheetOpen && (
        <div className="fixed inset-x-0 bottom-24 z-20 mx-auto w-full max-w-3xl px-4">
          <div className="grid gap-2 rounded-[8px] border border-slate-200 bg-white p-2 shadow-soft">
            <button
              type="button"
              onClick={chooseFile}
              className="min-h-12 rounded-[8px] bg-slate-100 font-extrabold text-ink"
            >
              选择图片或文件
            </button>
            <button
              type="button"
              onClick={openCamera}
              className="min-h-12 rounded-[8px] bg-ink font-extrabold text-white"
            >
              打开相机
            </button>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/92 px-2 py-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1.5">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseMode(item.id)}
              disabled={busy}
              className={`min-h-14 rounded-[8px] px-1 text-[12px] font-black leading-tight transition sm:text-sm ${
                mode === item.id
                  ? "bg-ink text-white"
                  : "bg-slate-100 text-slate-700"
              } disabled:opacity-60`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
