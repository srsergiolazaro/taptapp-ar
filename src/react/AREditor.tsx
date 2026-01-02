import { useState, useRef, useCallback } from "react";
import { customAlphabet } from "nanoid";
import { Image, Video, Upload, Camera, LoaderCircle } from "lucide-react";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];

interface FileUploadState {
  file: File | null;
  preview: string;
}

interface AREditorProps {
  adminId: string;
}

const useFileUpload = (allowedTypes: string[]) => {
  const [fileState, setFileState] = useState<FileUploadState>({ file: null, preview: "" });
  const [dimensions, setDimensions] = useState<{ width?: number; height?: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (fileState.preview) {
        URL.revokeObjectURL(fileState.preview);
      }

      if (!file) {
        setFileState({ file: null, preview: "" });
        return;
      }

      // Para archivos .mind, validar la extensión en lugar del tipo MIME
      if (allowedTypes.includes(".mind")) {
        if (!file.name.toLowerCase().endsWith(".mind")) {
          throw new Error("El archivo debe tener extensión .mind");
        }
      } else if (!allowedTypes.includes(file.type)) {
        throw new Error("Tipo de archivo no permitido");
      }

      if (file.type.includes("video")) {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
      }

      console.log("Archivo cargado:", {
        nombre: file.name,
        tamaño: (file.size / 1024).toFixed(2) + " KB",
        tipo: file.type || "application/octet-stream",
      });

      const preview = URL.createObjectURL(file);
      if (file.type.includes("video")) {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.addEventListener("loadedmetadata", () => {
          const width = video.videoWidth;
          const height = video.videoHeight;
          setDimensions({ width, height });
          console.log("Ancho y alto del video:", width, height);
        });
      }

      setFileState({ file, preview });
    },
    [allowedTypes, fileState.preview],
  );

  const reset = useCallback(() => {
    if (fileState.preview) {
      URL.revokeObjectURL(fileState.preview);
    }
    setFileState({ file: null, preview: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [fileState.preview]);

  return { fileState, handleFileChange, reset, fileInputRef, dimensions };
};

const useUploadFile = () => {
  const uploadFile = async (file: File, type: "image" | "video" | "mind") => {
    const customNanoid = customAlphabet("1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ", 21);
    const id = customNanoid();
    const formData = new FormData();
    formData.append("file", file);

    const endpoint =
      type === "video"
        ? `https://r2-worker.sergiolazaromondargo.workers.dev/video/${id}`
        : type === "mind"
          ? `https://r2-worker.sergiolazaromondargo.workers.dev/mind/${id}`
          : `https://r2-worker.sergiolazaromondargo.workers.dev/${id}`;

    const response = await fetch(endpoint, {
      method: "PUT",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error al subir ${type}: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  };

  return { uploadFile };
};

export const AREditor: React.FC<AREditorProps> = ({ adminId }) => {
  const {
    fileState: imageState,
    handleFileChange: handleImageChange,
    reset: resetImage,
    fileInputRef: imageInputRef,
  } = useFileUpload(ALLOWED_MIME_TYPES);

  const {
    fileState: mindState,
    handleFileChange: handleMindChange,
    reset: resetMind,
    fileInputRef: mindInputRef,
  } = useFileUpload([".mind"]);

  const {
    fileState: videoState,
    handleFileChange: handleVideoChange,
    reset: resetVideo,
    fileInputRef: videoInputRef,
    dimensions: videoDimensions,
  } = useFileUpload(ALLOWED_VIDEO_TYPES);

  const [videoScale, setVideoScale] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const { uploadFile } = useUploadFile();

  const handleSave = async () => {
    try {
      setLoading(true);
      setError("");

      if (!imageState.file || !mindState.file || !videoState.file) {
        throw new Error("Se requieren una imagen, un archivo .mind y un video");
      }

      const [imageResult, mindResult, videoResult] = await Promise.all([
        uploadFile(imageState.file, "image"),
        uploadFile(mindState.file, "mind"),
        uploadFile(videoState.file, "video"),
      ]);

      const data = {
        adminId,
        data: [
          {
            id: `photos-${Date.now()}`,
            type: "photos",
            images: [{ image: imageResult.url, fileId: imageResult.fileId }],
          },
          {
            id: `videoNative-${Date.now()}`,
            type: "videoNative",
            url: videoResult.url,
            fileId: videoResult.fileId,
            scale: videoScale,
            width: videoDimensions.width,
            height: videoDimensions.height,
          },
          {
            id: `ar-${Date.now()}`,
            type: "ar",
            url: mindResult.url,
            fileId: mindResult.fileId,
          },
        ],
        type: "ar",
      };

      const response = await fetch("/api/updateadmin.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Error actualizando datos AR: ${response.status}`);
      }

      alert("¡Guardado exitosamente!");
      resetImage();
      resetMind();
      resetVideo();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const FileUploadSection = ({
    type,
    icon: Icon,
    fileState,
    inputRef,
    onFileChange,
    allowedTypes,
    label,
  }: {
    type: string;
    icon: typeof Image;
    fileState: FileUploadState;
    inputRef: React.RefObject<HTMLInputElement>;
    onFileChange: (file: File | null) => void;
    allowedTypes: string[];
    label: string;
  }) => (
    <div className="group relative overflow-hidden rounded-xl shadow-lg bg-white/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:scale-[1.02] border border-gray-100">
      <input
        ref={inputRef}
        type="file"
        accept={allowedTypes.join(",")}
        onChange={(e) => {
          try {
            const file = e.target.files?.[0] || null;
            onFileChange(file);
          } catch (error: any) {
            setError(error.message);
          }
        }}
        className="hidden"
      />

      {!fileState.file ? (
        <label
          htmlFor={inputRef.current?.id}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center p-10 bg-gradient-to-br from-gray-50 to-white transition-colors group-hover:from-blue-50 group-hover:to-purple-50"
        >
          <div className="transform transition-transform duration-300 group-hover:scale-110">
            <Icon className="h-16 w-16 text-gray-400 group-hover:text-blue-500" />
          </div>
          <span className="mt-4 text-lg font-medium bg-gradient-to-r from-gray-600 to-gray-800 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-purple-600">
            {label}
          </span>
          <span className="mt-2 text-sm text-gray-400 group-hover:text-gray-500">
            {allowedTypes.join(", ")}
          </span>
        </label>
      ) : (
        <div className="p-6 space-y-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg ring-1 ring-gray-100">
            {type === "video" ? (
              <video src={fileState.preview} controls className="h-full w-full object-cover">
                Tu navegador no soporta la reproducción de videos.
              </video>
            ) : type === "image" ? (
              <img src={fileState.preview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center space-y-3 bg-gradient-to-br from-blue-50 to-purple-50 p-4">
                <div className="flex items-center justify-center rounded-full bg-gradient-to-r from-blue-400 to-purple-400 p-3">
                  <Upload className="h-6 w-6 text-white" />
                </div>
                <div className="text-center space-y-2">
                  <span className="block text-lg font-medium text-gray-600">
                    {fileState.file.name}
                  </span>
                  <span className="block text-sm text-gray-500">
                    Tamaño: {(fileState.file.size / 1024).toFixed(2)} KB
                  </span>
                  <span className="mt-1 block text-sm font-medium text-green-600">
                    ✓ Archivo AR cargado correctamente
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Icon className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-600">{fileState.file.name}</span>
            </div>
            <button
              onClick={() => onFileChange(null)}
              className="rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-blue-600 hover:to-purple-600 hover:shadow-lg active:scale-95"
            >
              Cambiar
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white/90 backdrop-blur-md p-6 md:p-10 shadow-2xl ring-1 ring-black/10">
        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 p-6 shadow-xl shadow-blue-300/30 hover:scale-105 transition-transform">
            <Camera className="h-12 w-12 text-white" />
          </div>
          <h1 className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-5xl font-bold text-transparent text-center">
            Editor de Experiencia AR
          </h1>
          <p className="text-2xl text-gray-600 text-center font-light">
            Crea una experiencia de realidad aumentada única
          </p>
        </div>

        <div className="mt-12 space-y-8">
          <FileUploadSection
            type="image"
            icon={Image}
            fileState={imageState}
            inputRef={imageInputRef}
            onFileChange={handleImageChange}
            allowedTypes={ALLOWED_MIME_TYPES}
            label="Haz clic para seleccionar una imagen"
          />

          <FileUploadSection
            type="mind"
            icon={Upload}
            fileState={mindState}
            inputRef={mindInputRef}
            onFileChange={handleMindChange}
            allowedTypes={[".mind"]}
            label="Haz clic para seleccionar archivo .mind"
          />

          <FileUploadSection
            type="video"
            icon={Video}
            fileState={videoState}
            inputRef={videoInputRef}
            onFileChange={handleVideoChange}
            allowedTypes={ALLOWED_VIDEO_TYPES}
            label="Haz clic para seleccionar un video"
          />

          <div className="space-y-4 rounded-2xl border border-gray-200/50 bg-white/90 backdrop-blur-md p-8 shadow-lg ring-1 ring-black/10">
            <label className="flex items-center justify-between text-2xl font-semibold text-gray-800">
              <span>Escala del Video</span>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                {videoScale}x
              </span>
            </label>
            <div className="relative py-8">
              <div className="absolute h-3 w-full rounded-full bg-gradient-to-r from-blue-400 to-purple-400 opacity-20"></div>
              <div
                className="absolute h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 shadow-lg"
                style={{ width: `${(videoScale / 2) * 100}%` }}
              ></div>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={videoScale}
                onChange={(e) => setVideoScale(Number(e.target.value))}
                className="relative h-3 w-full cursor-pointer appearance-none rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-4"
                style={{ WebkitAppearance: "none" }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700 shadow-sm ring-1 ring-red-100">
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading}
          className="mt-10 w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-5 text-xl font-semibold text-white shadow-xl transition-all hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-4"
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-3">
              <LoaderCircle className="h-7 w-7 animate-spin" />
              <span>Guardando...</span>
            </div>
          ) : (
            "Guardar"
          )}
        </button>
      </div>
    </div>
  );
};
