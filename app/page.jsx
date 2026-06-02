"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const modes = [
  { id: "summary", label: "总结", full: "资料总结" },
  { id: "imageTranslate", label: "翻译", full: "翻译图片" },
  { id: "product", label: "商品", full: "商品介绍" },
  { id: "homework", label: "题目", full: "题目解答" },
  { id: "calorie", label: "热量", full: "卡路里查询" },
  { id: "save", label: "保存", full: "文件保存" }
];

const saveFolders = [
  { id: "important", label: "重要资料" },
  { id: "documents", label: "证件" },
  { id: "media", label: "照片视频" },
  { id: "other", label: "其他" }
];

const driveFolderLinks = {
  important: "https://drive.google.com/drive/my-drive",
  documents: "https://drive.google.com/drive/my-drive",
  media: "https://drive.google.com/drive/my-drive",
  other: "https://drive.google.com/drive/my-drive"
};

const historyKey = "nancy-history-v1";

export default function Home() {
  const [mode, setMode] = useState("summary");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("请选择功能");
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preview, setPreview] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [inputText, setInputText] = useState("");
  const [saveFolder, setSaveFolder] = useState("important");
  const [history, setHistory] = useState([]);
  const [lastRequest, setLastRequest] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const currentMode = useMemo(
    () => modes.find((item) => item.id === mode) || modes[0],
    [mode]
  );

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(historyKey) || "[]"));
    } catch {
      setHistory([]);
    }
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
    setStatus(nextMode === "save" ? "选择要保存的文件或拍照" : "选择图片、文件或打开相机");
  }

  function chooseFile() {
    setSheetOpen(false);
    fileInputRef.current?.click();
  }

  function clearSelected() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setSelectedName("");
    setSelectedFile(null);
    setStatus("已清除选择");
  }

  async function onFileChange(event) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    setSelectedFile(selected);
    showPreview(selected);
    if (mode === "save") {
      setStatus("已选择文件，点保存打开 Google Drive");
      setResult(`已选择：${selected.name || "文件"}\n\n点“打开 Google Drive 保存”，然后在 Google Drive 里选择文件夹上传。`);
    } else {
      setStatus("已选择内容，点发送开始分析");
      setResult(`${selected.type === "application/pdf" ? "PDF" : "文件"}已选择：${selected.name || "已选择文件"}\n\n点右下方“发送”开始分析。`);
    }
  }

  function showPreview(file) {
    setSelectedName(file.name || "已选择文件");
    if (!file.type.startsWith("image/")) {
      if (preview) URL.revokeObjectURL(preview);
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

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || busy) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus("拍照失败，请再试一次");
        return;
      }
      const photo = new File([blob], `nancy-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      setSelectedFile(photo);
      showPreview(photo);
      stopCamera();
      if (mode === "save") {
        setStatus("已拍照，点保存打开 Google Drive");
        setResult("照片已准备好。\n\n点“打开 Google Drive 保存”，然后在 Google Drive 里选择文件夹上传。");
      } else {
        setStatus("已拍照，点发送开始分析");
        setResult("照片已准备好。\n\n点右下方“发送”开始分析。");
      }
    }, "image/jpeg", 0.92);
  }

  async function sendText() {
    if (mode === "save") {
      setStatus("文件保存请使用上方的保存按钮");
      return;
    }
    await analyze({ file: selectedFile, nextMode: mode, text: inputText });
  }

  async function regenerate() {
    if (!lastRequest || busy) return;
    await analyze(lastRequest, true);
  }

  async function analyze(request, keepRequest = false) {
    const cleanText = request.text.trim();
    if (!request.file && !cleanText) {
      setStatus("请先输入内容，或选择图片/文件");
      return;
    }

    setBusy(true);
    setResult("");
    setStatus(request.file ? "Nancy 正在看内容..." : "Nancy 正在整理中文结果...");

    try {
      const formData = new FormData();
      formData.append("mode", request.nextMode);
      formData.append("text", cleanText);
      if (request.file) formData.append("file", request.file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "分析失败");
      setResult(data.result);
      setStatus("完成");
      if (!keepRequest) setLastRequest(request);
      saveHistory(data.result, request.nextMode);
    } catch (error) {
      setStatus(error.message || "分析失败，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  function saveToDrive() {
    if (!selectedFile) {
      setStatus("请先选择文件或拍照");
      return;
    }
    const folderName = saveFolders.find((item) => item.id === saveFolder)?.label || "其他";
    const message = [
      `准备保存：${selectedFile.name || "已选择文件"}`,
      `建议文件夹：${folderName}`,
      "",
      "我已经帮你打开 Google Drive。",
      "请在 Google Drive 里进入对应文件夹，然后点击“新建”上传这个文件。",
      "",
      "如果你在手机上使用，也可以点系统分享，把文件保存到 Google Drive。"
    ].join("\n");
    setStatus("已打开 Google Drive");
    setResult(message);
    saveHistory(message, "save");
    window.open(driveFolderLinks[saveFolder], "_blank", "noopener,noreferrer");
  }

  function saveHistory(text, historyMode) {
    const item = {
      id: Date.now(),
      mode: modes.find((entry) => entry.id === historyMode)?.full || "记录",
      text,
      time: new Date().toLocaleString("zh-CN", { hour12: false })
    };
    const nextHistory = [item, ...history].slice(0, 10);
    setHistory(nextHistory);
    localStorage.setItem(historyKey, JSON.stringify(nextHistory));
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setStatus("结果已复制");
  }

  function loadHistory(item) {
    setResult(item.text);
    setStatus(`已打开历史：${item.mode}`);
  }

  return (
    <main className="min-h-screen bg-paper pb-48 text-ink">
      <input
        ref={fileInputRef}
        type="file"
        accept={mode === "save" ? "image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" : "image/*,application/pdf"}
        className="sr-only"
        onChange={onFileChange}
      />

      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-3 pt-3 sm:px-6">
        <div className="sticky top-0 z-10 -mx-3 border-b border-slate-200 bg-paper/95 px-3 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-500">当前功能</p>
              <p className="text-lg font-black text-ink">{currentMode.full}</p>
            </div>
            <p className="max-w-[58%] text-right text-sm font-semibold text-slate-600">{status}</p>
          </div>

          {(selectedName || inputText) && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm">
              <p className="min-w-0 flex-1 truncate font-bold text-slate-700">
                {selectedName ? `已选择：${selectedName}` : "可以直接发送文字"}
              </p>
              {selectedName && (
                <button type="button" onClick={clearSelected} className="font-black text-slate-500">
                  清除
                </button>
              )}
            </div>
          )}
        </div>

        {cameraOpen && (
          <div className="mt-4 overflow-hidden rounded-[8px] bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="aspect-[3/4] w-full object-cover sm:aspect-video" />
            <div className="grid grid-cols-2 gap-2 bg-white p-2">
              <button type="button" onClick={stopCamera} className="min-h-12 rounded-[8px] bg-slate-100 font-bold text-slate-700">
                取消
              </button>
              <button type="button" onClick={capturePhoto} disabled={busy} className="min-h-12 rounded-[8px] bg-ink font-bold text-white disabled:bg-slate-400">
                拍照
              </button>
            </div>
          </div>
        )}

        {(preview || selectedName) && !cameraOpen && (
          <div className="mt-4 rounded-[8px] border border-slate-200 bg-white p-3 shadow-soft">
            {preview ? (
              <img src={preview} alt="已选择内容" className="max-h-72 w-full rounded-[8px] object-contain" />
            ) : (
              <p className="py-5 text-center font-bold text-slate-600">{selectedName}</p>
            )}
          </div>
        )}

        {mode === "save" && (
          <div className="mt-4 rounded-[8px] border border-slate-200 bg-white p-3 shadow-soft">
            <p className="mb-2 text-sm font-black text-slate-700">保存到</p>
            <div className="grid grid-cols-4 gap-2">
              {saveFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSaveFolder(folder.id)}
                  className={`min-h-11 rounded-[8px] px-1 text-sm font-black ${
                    saveFolder === folder.id ? "bg-ink text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {folder.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={saveToDrive}
              disabled={busy || !selectedFile}
              className="mt-3 min-h-12 w-full rounded-[8px] bg-ink font-black text-white disabled:bg-slate-400"
            >
              打开 Google Drive 保存
            </button>
          </div>
        )}

        <article className="mt-4 flex-1 whitespace-pre-wrap rounded-[8px] bg-white p-4 text-[17px] leading-8 shadow-soft">
          {result || (
            <div className="grid min-h-[42vh] place-items-center text-center text-slate-400">
              <p>{busy ? "Nancy 正在生成中文内容..." : "结果会显示在这里"}</p>
            </div>
          )}
        </article>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button type="button" onClick={copyResult} disabled={!result} className="min-h-11 rounded-[8px] bg-slate-100 text-sm font-black text-slate-700 disabled:opacity-40">
            复制结果
          </button>
          <button type="button" onClick={regenerate} disabled={!lastRequest || busy || mode === "save"} className="min-h-11 rounded-[8px] bg-slate-100 text-sm font-black text-slate-700 disabled:opacity-40">
            重新生成
          </button>
          <button type="button" onClick={() => setHistory([]) || localStorage.removeItem(historyKey)} className="min-h-11 rounded-[8px] bg-slate-100 text-sm font-black text-slate-700">
            清空历史
          </button>
        </div>

        {history.length > 0 && (
          <div className="mt-4 pb-4">
            <p className="mb-2 text-sm font-black text-slate-500">最近记录</p>
            <div className="grid gap-2">
              {history.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadHistory(item)}
                  className="rounded-[8px] border border-slate-200 bg-white p-3 text-left shadow-soft"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-ink">{item.mode}</span>
                    <span className="text-xs font-semibold text-slate-400">{item.time}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{item.text}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {sheetOpen && (
        <div className="fixed inset-x-0 bottom-40 z-20 mx-auto w-full max-w-3xl px-4">
          <div className="grid gap-2 rounded-[8px] border border-slate-200 bg-white p-2 shadow-soft">
            <button type="button" onClick={chooseFile} className="min-h-12 rounded-[8px] bg-slate-100 font-extrabold text-ink">
              选择图片或文件
            </button>
            <button type="button" onClick={openCamera} className="min-h-12 rounded-[8px] bg-ink font-extrabold text-white">
              打开相机
            </button>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-[82px] z-30 border-t border-slate-200 bg-white/92 px-2 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendText();
              }
            }}
            placeholder="输入问题或补充要求"
            className="min-h-12 min-w-0 flex-1 rounded-[8px] border border-slate-200 bg-white px-3 text-base text-ink placeholder:text-slate-400"
          />
          <button type="button" onClick={sendText} disabled={busy} className="min-h-12 rounded-[8px] bg-ink px-4 text-sm font-black text-white disabled:bg-slate-400">
            发送
          </button>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/92 px-2 py-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-6 gap-1">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseMode(item.id)}
              disabled={busy}
              className={`min-h-12 rounded-[8px] px-1 text-[12px] font-black leading-tight transition sm:text-sm ${
                mode === item.id ? "bg-ink text-white" : "bg-slate-100 text-slate-700"
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
