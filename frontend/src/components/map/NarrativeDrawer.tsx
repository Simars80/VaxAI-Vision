import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { narrativeStreamUrl } from "@/api/routes";
import { createLogger } from "@/lib/logger";

const logger = createLogger("NarrativeDrawer");

interface Props {
  simulationId: string;
  open: boolean;
  onClose: () => void;
}

export function NarrativeDrawer({ simulationId, open, onClose }: Props) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setText("");
      setStreaming(false);
      setStreamError(null);
      return;
    }

    setText("");
    setStreamError(null);
    setStreaming(true);

    const url = narrativeStreamUrl(simulationId);
    logger.info("Opening SSE stream", { simulationId, url });

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event: MessageEvent<string>) => {
      setText((prev) => prev + event.data);
      // Auto-scroll to bottom.
      if (textareaRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    };

    es.addEventListener("done", () => {
      logger.info("SSE stream complete", { simulationId });
      setStreaming(false);
      es.close();
    });

    es.onerror = (err) => {
      logger.error("SSE stream error", { simulationId, err });
      setStreamError("Narrative stream disconnected.");
      setStreaming(false);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [open, simulationId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="relative z-10 w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">AI Disruption Narrative</h2>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden p-4 flex flex-col gap-2">
          {streaming && !text && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating narrative…
            </div>
          )}

          {streamError && (
            <p className="text-xs text-red-600">{streamError}</p>
          )}

          <textarea
            ref={textareaRef}
            readOnly
            value={text}
            className="flex-1 w-full min-h-[200px] resize-none rounded-md border bg-muted/40 p-3 text-sm font-mono leading-relaxed focus:outline-none"
            placeholder="Narrative will stream here…"
          />

          {streaming && text && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Streaming…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
