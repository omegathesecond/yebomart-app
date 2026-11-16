import { useEffect, useState } from "react";
import { call, type MenuItem } from "./api";
import { ErrorMessage } from "./shared";

export async function prepareDishPhoto(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG or WebP meal photo.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "This browser could not prepare the photo. Try another browser.",
      );
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(
                new Error(
                  "The photo could not be prepared. Try another picture.",
                ),
              ),
        "image/jpeg",
        0.86,
      ),
    );
    if (blob.size > 6 * 1024 * 1024)
      throw new Error(
        "This photo is still too large. Take a closer photo of one meal.",
      );
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function usePhotoPreview(file?: File) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return url;
}
export function DishPhoto({
  url,
  name,
  className = "aspect-[4/3] w-full",
}: {
  url: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return failed ? (
    <p
      role="alert"
      className={
        "border border-line bg-sand p-4 text-sm text-mute " + className
      }
    >
      This dish photo could not load. Refresh the page to try again.
    </p>
  ) : (
    <img
      src={url}
      alt={name}
      loading="lazy"
      className={"object-cover " + className}
      onError={() => setFailed(true)}
    />
  );
}
export function DishPhotoEditor({
  item,
  onSaved,
}: {
  item: MenuItem;
  onSaved: () => Promise<unknown>;
}) {
  const [photo, setPhoto] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const preview = usePhotoPreview(photo);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 items-start">
        {(preview || item.imageUrl) && (
          <DishPhoto
            url={preview || item.imageUrl!}
            name={photo ? "Your new photo of " + item.name : item.name}
            className="h-28 w-36"
          />
        )}
        <label className="text-sm grid gap-2">
          <span>
            {item.imageUrl
              ? "Change dish photo"
              : "Add a photo of the actual dish"}
          </span>
          <input
            aria-label={"Photo for " + item.name}
            className="input max-w-full"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={busy}
            onChange={async (e) => {
              const value = e.target.files?.[0];
              e.target.value = "";
              if (!value) return;
              setBusy(true);
              setError(null);
              try {
                setPhoto(await prepareDishPhoto(value));
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      <ErrorMessage error={error} />
      {photo && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const body = new FormData();
                body.append("photo", photo);
                await call(
                  "/restaurant/menu/" + item.id + "/photo",
                  "PUT",
                  body,
                );
                await onSaved();
                setPhoto(undefined);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving photo…" : "Use this dish photo"}
          </button>
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => setPhoto(undefined)}
          >
            Keep current photo
          </button>
          <p className="text-xs text-mute">
            This picture will be public on your menu after you save it.
          </p>
        </div>
      )}
    </div>
  );
}
