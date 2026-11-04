"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCroppedBlob } from "@/lib/crop-image";

export function AvatarCropper({
  open,
  imageSrc,
  onOpenChange,
  onCropped,
}: {
  open: boolean;
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onCropped: (blob: Blob) => Promise<void> | void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [pending, setPending] = useState(false);

  const onComplete = useCallback((_cropped: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  async function save() {
    if (!imageSrc || !area) return;
    setPending(true);
    try {
      const blob = await getCroppedBlob(imageSrc, area);
      await onCropped(blob);
      onOpenChange(false);
    } catch {
      // Ошибку показывает вызывающий экран, диалог остаётся открытым.
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Обрезать аватар</DialogTitle>
        </DialogHeader>
        <div className="relative h-72 overflow-hidden rounded-lg bg-muted">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
            />
          ) : null}
        </div>
        <label className="flex items-center gap-3 text-sm">
          Масштаб
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full"
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button disabled={pending} onClick={() => void save()}>
            {pending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
