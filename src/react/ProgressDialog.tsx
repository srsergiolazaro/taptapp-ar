import React, { useEffect } from "react";
import {
  CheckCircle2,
  Loader2,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";

interface ProgressStage {
  label: string;
  status: "pending" | "processing" | "completed" | "error";
  progress?: number;
  icon: React.ReactNode;
}

interface ProgressDialogProps {
  open: boolean;
  imageStatus: "pending" | "processing" | "completed" | "error";
  videoStatus: "pending" | "processing" | "completed" | "error";
  arProcessingStatus: "pending" | "processing" | "completed" | "error";
  arUploadStatus: "pending" | "processing" | "completed" | "error";
  imageProgress?: number;
  videoProgress?: number;
  arProcessingProgress?: number;
  arUploadProgress?: number;
}

export function ProgressDialog({
  open,
  imageStatus,
  videoStatus,
  arProcessingStatus,
  arUploadStatus,
  imageProgress = 0,
  videoProgress = 0,
  arProcessingProgress = 0,
  arUploadProgress = 0,
}: ProgressDialogProps) {
  // Configurar las etapas del progreso
  const stages: ProgressStage[] = [
    {
      label: "Subiendo imagen",
      status: imageStatus,
      progress: imageProgress,
      icon: <ImageIcon className="h-5 w-5" />,
    },
    {
      label: "Subiendo video",
      status: videoStatus,
      progress: videoProgress,
      icon: <VideoIcon className="h-5 w-5" />,
    },
    {
      label: "Procesando imagen para AR",
      status: arProcessingStatus,
      progress: arProcessingProgress,
      icon: <Loader2 className="h-5 w-5" />,
    },
    {
      label: "Subiendo experiencia AR",
      status: arUploadStatus,
      progress: arUploadProgress,
      icon: <Upload className="h-5 w-5" />,
    },
  ];

  // Calcular el progreso total (promedio de todos los procesos)
  const completedSteps = stages.filter((stage) => stage.status === "completed").length;
  const totalProgress =
    (imageProgress + videoProgress + arProcessingProgress + arUploadProgress) / 4;
  const overallProgress = Math.min(Math.max(totalProgress, completedSteps * 25), 100);

  // Bloquear el scroll cuando el modal está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50 p-4">
      <div className="relative max-h-full w-full max-w-md overflow-hidden rounded-lg bg-white p-6 shadow-xl">
        {/* Encabezado */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-center font-semibold text-xl">Guardando experiencia AR</h2>
        </div>

        {/* Barra de progreso general */}
        <div className="mt-2">
          <div className="relative pt-1">
            <div className="mb-6">
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                ></div>
              </div>
              <div className="mt-2 text-center text-gray-600 text-sm">
                Progreso total: {Math.round(overallProgress)}%
              </div>
            </div>
          </div>
        </div>

        {/* Etapas individuales */}
        <div className="mt-2 space-y-5">
          {stages.map((stage, index) => (
            <div key={index} className="relative">
              <div className="flex items-center">
                <div
                  className={`mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${stage.status === "completed"
                    ? "bg-green-100"
                    : stage.status === "processing"
                      ? "bg-blue-100"
                      : stage.status === "error"
                        ? "bg-red-100"
                        : "bg-gray-100"
                    }`}
                >
                  {stage.status === "completed" ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : stage.status === "processing" ? (
                    <div className="text-blue-600">{stage.icon}</div>
                  ) : stage.status === "error" ? (
                    <div className="text-red-600">{stage.icon}</div>
                  ) : (
                    <div className="text-gray-400">{stage.icon}</div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{stage.label}</div>

                  {stage.status === "processing" && (
                    <div className="mt-1">
                      <div className="h-1.5 w-full rounded-full bg-gray-200">
                        <div
                          className="h-1.5 rounded-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${stage.progress || 0}%` }}
                        ></div>
                      </div>
                      <div className="mt-1 text-gray-500 text-xs">
                        {Math.round(stage.progress || 0)}%
                      </div>
                    </div>
                  )}

                  {stage.status === "completed" && (
                    <div className="mt-1 text-green-600 text-xs">Completado</div>
                  )}

                  {stage.status === "error" && (
                    <div className="mt-1 text-red-600 text-xs">Error</div>
                  )}

                  {stage.status === "pending" && (
                    <div className="mt-1 text-gray-500 text-xs">Pendiente</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mensaje de finalización */}
        {completedSteps === stages.length && (
          <div className="mt-4 rounded-lg bg-green-50 p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
            <p className="font-medium text-green-800">¡Experiencia AR guardada con éxito!</p>
            <p className="text-green-700 text-sm">Tu contenido está listo para ser visualizado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
