"use client";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
export function ClubVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState(false);
  async function toggle() {
    if (!ref.current) return;
    try {
      if (ref.current.paused) await ref.current.play();
      else ref.current.pause();
    } catch {
      setError(true);
    }
  }
  return (
    <div className="club-video">
      <video
        ref={ref}
        src="/media/seven.mp4"
        poster="/media/club.jpeg"
        preload="metadata"
        muted={muted}
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
        aria-label="Video de Los Cedros Rugby Club"
      />
      {!playing && (
        <button
          className="video-play"
          aria-label="Reproducir video del club"
          onClick={toggle}
        >
          <Play fill="currentColor" size={30} />
        </button>
      )}
      <div className="video-caption">
        <span>ESTO ES LOS CEDROS.</span>
        <div>
          <button
            aria-label={playing ? "Pausar video" : "Reproducir video"}
            onClick={toggle}
          >
            {playing ? <Pause size={19} /> : <Play size={19} />}
          </button>
          <button
            aria-label={muted ? "Activar sonido" : "Silenciar"}
            onClick={() => setMuted(!muted)}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
        </div>
      </div>
      {error && (
        <p className="video-error">
          No se pudo reproducir el video.{" "}
          <a href="/media/seven.mp4" download>
            Descargar video
          </a>
        </p>
      )}
    </div>
  );
}
