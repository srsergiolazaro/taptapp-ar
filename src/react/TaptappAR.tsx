import { useEffect, useRef, useState } from "react";
import type { ARConfig } from "./types.js";

interface ARViewerProps {
    config: ARConfig;
}

export const ARViewer: React.FC<ARViewerProps> = ({ config }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLVideoElement | HTMLImageElement>(null);
    const [status, setStatus] = useState<"scanning" | "tracking" | "error">("scanning");
    const [isPlaying, setIsPlaying] = useState(false);
    const arInstanceRef = useRef<any>(null);

    useEffect(() => {
        let isMounted = true;

        const initAR = async () => {
            if (!containerRef.current || !overlayRef.current) return;

            try {
                // @ts-ignore
                window.AR_DEBUG = true;
                const { SimpleAR } = await import("@srsergio/taptapp-ar");

                const isVideo = config.overlayType === "video";

                // Set initial overlay styles (SimpleAR will handle positioning)
                const overlayEl = overlayRef.current;
                overlayEl.style.opacity = "0";
                overlayEl.style.transition = "opacity 0.3s ease";
                overlayEl.style.pointerEvents = "none";
                overlayEl.style.zIndex = "10";

                const arInstance = new (SimpleAR as any)({
                    container: containerRef.current,
                    targetSrc: config.targetTaarSrc,
                    overlay: overlayRef.current,
                    scale: config.scale,
                    onFound: async ({ targetIndex }: { targetIndex: number }) => {
                        console.log(`🎯 Target ${targetIndex} detected!`);
                        if (!isMounted) return;
                        setStatus("tracking");

                        if (isVideo && overlayRef.current) {
                            try {
                                await (overlayRef.current as HTMLVideoElement).play();
                                setIsPlaying(true);
                            } catch (err) {
                                console.warn("Auto-play blocked:", err);
                            }
                        }
                    },
                    onLost: ({ targetIndex }: { targetIndex: number }) => {
                        console.log(`👋 Target ${targetIndex} lost`);
                        if (!isMounted) return;
                        setStatus("scanning");

                        if (isVideo && overlayRef.current) {
                            (overlayRef.current as HTMLVideoElement).pause();
                            setIsPlaying(false);
                        }
                    }
                });

                arInstanceRef.current = arInstance;
                await arInstance.start();

                if (isMounted) {
                    setStatus("scanning");
                }
            } catch (err) {
                console.error("Failed to initialize AR:", err);
                if (isMounted) {
                    setStatus("error");
                }
            }
        };

        initAR();

        return () => {
            isMounted = false;
            if (arInstanceRef.current) {
                arInstanceRef.current.stop();
            }
        };
    }, [config]);

    const handleClick = async () => {
        if (config.overlayType !== "video" || !overlayRef.current) return;
        const videoEl = overlayRef.current as HTMLVideoElement;

        try {
            if (isPlaying) {
                videoEl.pause();
                setIsPlaying(false);
            } else {
                await videoEl.play();
                setIsPlaying(true);
            }
        } catch (err) {
            console.error("Error toggling video:", err);
        }
    };

    return (
        <>
            {/* Scanning Overlay */}
            <div className={`overlay-ui scanning-overlay ${status !== "scanning" ? "hidden" : "visible"}`}>
                <div className="scanning-frame">
                    <img
                        className="target-preview"
                        src={config.targetImageSrc}
                        alt="Apunta aquí"
                        crossOrigin="anonymous"
                        loading="eager"
                        // @ts-ignore
                        fetchpriority="high"
                    />
                </div>
                <p className="overlay-text">Apunta a la imagen para comenzar</p>
            </div>

            {/* Error Overlay */}
            <div className={`overlay-ui error-overlay ${status !== "error" ? "hidden" : "visible"}`}>
                <span className="error-icon">⚠️</span>
                <p className="overlay-text">No se pudo iniciar la experiencia AR</p>
                <p className="overlay-subtext">Verifica los permisos de cámara e intenta nuevamente</p>
                <button className="retry-btn" onClick={() => window.location.reload()}>Reintentar</button>
            </div>

            {/* AR Container */}
            <div ref={containerRef} className="ar-container" onClick={handleClick}>
                {config.overlayType === "video" ? (
                    <video
                        ref={overlayRef as React.RefObject<HTMLVideoElement>}
                        className="ar-overlay"
                        src={config.overlaySrc}
                        preload="auto"
                        loop
                        playsInline
                        muted
                        crossOrigin="anonymous"
                    />
                ) : (
                    <img
                        ref={overlayRef as React.RefObject<HTMLImageElement>}
                        className="ar-overlay"
                        src={config.overlaySrc}
                        crossOrigin="anonymous"
                        alt="AR Overlay"
                        loading="eager"
                        // @ts-ignore
                        fetchpriority="high"
                    />
                )}
            </div>
        </>
    );
};
