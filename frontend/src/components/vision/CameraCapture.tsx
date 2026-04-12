import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  disabled?: boolean;
}

export default function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setCameraActive(true);
    } catch {
      setError("Camera access denied or unavailable. Use file upload instead.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraActive(false);
  }, [stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `vvm-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      setPreview(canvas.toDataURL("image/jpeg"));
      stopCamera();
      onCapture(file);
    }, "image/jpeg", 0.9);
  }, [onCapture, stopCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    onCapture(file);
  };

  const reset = () => {
    setPreview(null);
    setError(null);
  };

  if (preview) {
    return (
      <div className="relative rounded-lg overflow-hidden border bg-muted">
        <img src={preview} alt="Captured" className="w-full max-h-80 object-contain" />
        <Button
          variant="outline"
          size="sm"
          className="absolute top-2 right-2"
          onClick={reset}
          disabled={disabled}
        >
          <X className="h-4 w-4 mr-1" /> Retake
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cameraActive ? (
        <div className="relative rounded-lg overflow-hidden border bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-80 object-contain"
          />
          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-3">
            <Button onClick={capture} disabled={disabled} className="rounded-full h-14 w-14">
              <Camera className="h-6 w-6" />
            </Button>
            <Button variant="outline" onClick={stopCamera} className="rounded-full h-14 w-14">
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4 bg-muted/30">
          <div className="flex items-center justify-center gap-3">
            <Button onClick={startCamera} disabled={disabled}>
              <Camera className="h-4 w-4 mr-2" /> Open Camera
            </Button>
            <span className="text-sm text-muted-foreground">or</span>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              <Upload className="h-4 w-4 mr-2" /> Upload Photo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Point the camera at a VVM indicator on a vaccine vial for classification
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
          {error}
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" /> Upload instead
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
