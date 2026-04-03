import { useState, useCallback, useRef } from "react";
import { Upload, Download, ImageIcon, Sparkles, RefreshCw, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Transform, removeBackground, featherEdges } from "@/lib/transformation";

type ProcessingState = "idle" | "uploading" | "processing" | "done" | "error";

interface ImageResult {
  original: string;
  processed: string;
  filename: string;
  canvasRef: HTMLCanvasElement | null;
}

export default function Home() {
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [result, setResult] = useState<ImageResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [enhanced, setEnhanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    setProcessingState("uploading");
    setProgress(10);
    setEnhanced(false);

    const originalUrl = URL.createObjectURL(file);

    try {
      const img = new Image();
      img.src = originalUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
      });

      setProcessingState("processing");
      setProgress(35);

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      ctx.drawImage(img, 0, 0);
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      setProgress(55);

      imageData = removeBackground(imageData, 55);

      setProgress(75);

      imageData = featherEdges(imageData, 2);

      setProgress(88);

      ctx.putImageData(imageData, 0, 0);

      setProgress(95);

      const processedUrl = canvas.toDataURL("image/png");

      setResult({
        original: originalUrl,
        processed: processedUrl,
        filename: file.name.replace(/\.[^/.]+$/, "") + "_no_bg.png",
        canvasRef: canvas,
      });

      setProgress(100);
      setProcessingState("done");
    } catch {
      setProcessingState("error");
      toast({ title: "Processing failed", description: "Could not process the image. Please try again.", variant: "destructive" });
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processImage(file);
  }, [processImage]);

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.processed;
    a.download = result.filename;
    a.click();
  };

  const handleReset = () => {
    setResult(null);
    setProcessingState("idle");
    setProgress(0);
    setEnhanced(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyEnhancement = () => {
    if (!result || !result.canvasRef) return;
    if (enhanced) {
      toast({ title: "Already enhanced", description: "Enhancement has already been applied." });
      return;
    }

    try {
      const canvas = result.canvasRef;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const transform = new Transform();
      transform.brightness(1.08).contrast(1.12).saturation(1.15);
      const enhanced_data = transform.applyToImageData(imageData);
      ctx.putImageData(enhanced_data, 0, 0);

      const newUrl = canvas.toDataURL("image/png");
      setResult({ ...result, processed: newUrl });
      setEnhanced(true);
      toast({ title: "Image enhanced!", description: "Applied brightness, contrast and saturation boost via Transformation.js." });
    } catch {
      toast({ title: "Enhancement failed", description: "Could not apply enhancement.", variant: "destructive" });
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pink-blob w-[500px] h-[500px] bg-pink-300 -top-20 -right-40" />
      <div className="pink-blob w-[400px] h-[400px] bg-fuchsia-300 bottom-10 -left-32" />
      <div className="pink-blob w-[300px] h-[300px] bg-rose-200 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="px-6 py-5 flex items-center justify-between border-b border-border/50 backdrop-blur-sm bg-background/70 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                PinkBG
              </h1>
              <p className="text-xs text-muted-foreground">Background Remover</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-secondary border border-border/50">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Free &amp; instant
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-10">
          <div className="text-center max-w-xl">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              Remove backgrounds
              <span className="block bg-gradient-to-r from-pink-500 via-rose-400 to-fuchsia-500 bg-clip-text text-transparent">
                in seconds
              </span>
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              Upload any image and get a clean, transparent background instantly — powered by Transformation.js
            </p>
          </div>

          {processingState === "idle" && (
            <div
              data-testid="upload-zone"
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative w-full max-w-lg cursor-pointer rounded-3xl border-2 border-dashed p-12
                flex flex-col items-center gap-5 transition-all duration-300
                ${dragOver
                  ? "border-primary bg-primary/8 scale-105"
                  : "border-border hover:border-primary/60 hover:bg-primary/4 bg-card/60 backdrop-blur-sm"
                }
              `}
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center shadow-sm">
                <Upload className="w-9 h-9 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-foreground font-semibold text-lg mb-1">Drop your image here</p>
                <p className="text-muted-foreground text-sm">or click to browse · PNG, JPG, WEBP</p>
              </div>
              <Button
                data-testid="button-upload"
                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-0 rounded-xl px-8 py-2.5 shadow-md hover:shadow-lg transition-all duration-200"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Choose Image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-file"
              />
            </div>
          )}

          {(processingState === "uploading" || processingState === "processing") && (
            <div className="w-full max-w-lg rounded-3xl bg-card/80 backdrop-blur-sm border border-border p-10 flex flex-col items-center gap-6 shadow-lg">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                <ImageIcon className="absolute inset-0 m-auto w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-lg mb-1">
                  {processingState === "uploading" ? "Loading image..." : "Removing background..."}
                </p>
                <p className="text-muted-foreground text-sm">
                  {progress < 55 ? "Analyzing image..." : progress < 80 ? "Detecting background..." : "Feathering edges..."}
                </p>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progress}% complete</p>
            </div>
          )}

          {processingState === "done" && result && (
            <div className="w-full max-w-4xl flex flex-col gap-6">
              <div className="flex items-center justify-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="font-medium text-sm">Background removed successfully!</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
                  <div className="px-4 py-3 border-b border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Original</span>
                  </div>
                  <div className="p-4 h-72 flex items-center justify-center bg-muted/20">
                    <img
                      data-testid="img-original"
                      src={result.original}
                      alt="Original"
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  </div>
                </div>

                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
                  <div className="px-4 py-3 border-b border-border flex items-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Result</span>
                    <span className="ml-auto text-xs text-primary font-semibold">Transparent PNG</span>
                  </div>
                  <div className="p-4 h-72 flex items-center justify-center checker-bg">
                    <img
                      data-testid="img-result"
                      src={result.processed}
                      alt="Background removed"
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  data-testid="button-download"
                  onClick={handleDownload}
                  className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-0 rounded-xl px-8 py-2.5 shadow-md hover:shadow-lg transition-all duration-200 gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PNG
                </Button>
                <Button
                  data-testid="button-enhance"
                  variant="outline"
                  onClick={applyEnhancement}
                  disabled={enhanced}
                  className="rounded-xl px-6 py-2.5 border-primary/40 text-primary hover:bg-primary/8 gap-2 disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4" />
                  {enhanced ? "Enhanced!" : "Enhance Image"}
                </Button>
                <Button
                  data-testid="button-reset"
                  variant="ghost"
                  onClick={handleReset}
                  className="rounded-xl px-6 py-2.5 text-muted-foreground hover:text-foreground gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Another
                </Button>
              </div>
            </div>
          )}

          {processingState === "error" && (
            <div className="w-full max-w-lg rounded-3xl bg-card/80 backdrop-blur-sm border border-destructive/30 p-10 flex flex-col items-center gap-5 shadow-lg">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <X className="w-8 h-8 text-destructive" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-lg mb-1">Something went wrong</p>
                <p className="text-muted-foreground text-sm">The image could not be processed. Please try a different image.</p>
              </div>
              <Button
                data-testid="button-retry"
                onClick={handleReset}
                className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0 rounded-xl px-8"
              >
                Try Again
              </Button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-5 w-full max-w-lg">
            {[
              { icon: "⚡", title: "Instant", desc: "Results in seconds" },
              { icon: "🆓", title: "100% Free", desc: "No sign-up needed" },
              { icon: "🔒", title: "Private", desc: "Processed locally" },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/60 p-5 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="font-semibold text-foreground text-sm">{item.title}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="px-6 py-4 text-center text-xs text-muted-foreground border-t border-border/50 backdrop-blur-sm bg-background/50">
          Powered by Transformation.js · Images processed entirely in your browser
        </footer>
      </div>
    </div>
  );
}
