import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Maximize2, Pause, Play, RotateCcw, SkipForward, Tv } from "lucide-react";
import { DEFAULT_CLINIC_SESSION_ROUNDS, TARGET_PROGRAM_SECONDS, programs, videos, type ClinicVideo } from "./videoData";
import "./styles.css";

type PlayItem = ClinicVideo & {
  programIndex: number;
  round: number;
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function sourceFor(video: ClinicVideo, shouldAutoplay: boolean) {
  if (video.type === "mp4") return video.src;
  const separator = video.src.includes("?") ? "&" : "?";
  const autoplayParams = shouldAutoplay ? "autoplay=1&mute=1&" : "";
  if (video.type === "youtube") {
    return `${video.src}${separator}${autoplayParams}controls=1&rel=0&playsinline=1`;
  }
  return `${video.src}${separator}${autoplayParams}playsinline=1`;
}

function buildQueue(videoIds: string[], rounds = DEFAULT_CLINIC_SESSION_ROUNDS) {
  const base = videoIds
    .map((id, index) => {
      const video = videos.find((item) => item.id === id);
      if (!video) return null;
      return { ...video, programIndex: index + 1, round: 1 };
    })
    .filter(Boolean) as PlayItem[];

  return Array.from({ length: rounds }).flatMap((_, roundIndex) =>
    base.map((item) => ({ ...item, round: roundIndex + 1 }))
  );
}

function sumDuration(items: Array<{ durationSeconds: number }>) {
  return items.reduce((total, item) => total + item.durationSeconds, 0);
}

function ProgramPlayer() {
  const [programId, setProgramId] = useState(programs[0].id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);

  const program = programs.find((item) => item.id === programId) || programs[0];
  const programRounds = program.rounds || DEFAULT_CLINIC_SESSION_ROUNDS;
  const queue = useMemo(() => buildQueue(program.videoIds, programRounds), [program.videoIds, programRounds]);
  const baseVideos = useMemo(() => buildQueue(program.videoIds, 1), [program.videoIds]);
  const currentVideo = queue[currentIndex] || queue[0];
  const baseDuration = sumDuration(baseVideos);
  const sessionDuration = sumDuration(queue);
  const playedBeforeCurrent = sumDuration(queue.slice(0, currentIndex));
  const elapsed = playedBeforeCurrent + Math.max(0, currentVideo.durationSeconds - secondsLeft);
  const sessionLeft = Math.max(0, sessionDuration - elapsed);

  useEffect(() => {
    setCurrentIndex(0);
    if (hasStarted) setIsPlaying(true);
  }, [hasStarted, programId]);

  useEffect(() => {
    setSecondsLeft(currentVideo?.durationSeconds || 0);
  }, [currentVideo?.id, currentVideo?.round]);

  useEffect(() => {
    if (!isPlaying || !currentVideo) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setCurrentIndex((index) => (index + 1) % queue.length);
          return currentVideo.durationSeconds;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentVideo, isPlaying, queue.length]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (isPlaying) {
      element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, [currentVideo?.id, currentVideo?.round, isPlaying]);

  const goNext = () => {
    setCurrentIndex((index) => (index + 1) % queue.length);
  };

  const startContinuousPlay = () => {
    setHasStarted(true);
    setIsPlaying(true);
  };

  const restart = () => {
    setCurrentIndex(0);
    setHasStarted(true);
    setIsPlaying(true);
  };

  const openFullscreen = () => {
    playerRef.current?.requestFullscreen?.();
  };

  return (
    <main className="app-shell">
      <aside className="control-panel" aria-label="播放清單控制">
        <div className="brand">
          <Tv size={30} aria-hidden="true" />
          <div>
            <p>COPD 候診區</p>
            <h1>衛教影片循環播放</h1>
          </div>
        </div>

        <section className="panel-section">
          <p className="section-kicker">選擇播放組合</p>
          <div className="program-list">
            {programs.map((item) => {
              const selected = item.id === programId;
              const itemRounds = item.rounds || DEFAULT_CLINIC_SESSION_ROUNDS;
              const itemBase = buildQueue(item.videoIds, 1);
              const itemBaseDuration = sumDuration(itemBase);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={selected ? "program-card is-selected" : "program-card"}
                  onClick={() => setProgramId(item.id)}
                >
                  <span>{item.title}</span>
                  <small>{formatTime(itemBaseDuration)} x {itemRounds} = {formatTime(itemBaseDuration * itemRounds)}</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel-section">
          <p className="section-kicker">目前組合</p>
          <h2>{program.title}</h2>
          <p className="muted">{program.subtitle}</p>
          <dl className="time-grid">
            <div>
              <dt>單輪估計</dt>
              <dd>{formatTime(baseDuration)}</dd>
            </div>
            <div>
              <dt>門診播放</dt>
              <dd>{formatTime(sessionDuration)}</dd>
            </div>
            <div>
              <dt>目標單輪</dt>
              <dd>{formatTime(TARGET_PROGRAM_SECONDS)}</dd>
            </div>
            <div>
              <dt>剩餘時間</dt>
              <dd>{formatTime(sessionLeft)}</dd>
            </div>
          </dl>
        </section>

        <section className="panel-section playlist-section">
          <p className="section-kicker">單輪內容</p>
          <ol className="playlist">
            {baseVideos.map((video, index) => (
              <li key={video.id} className={currentVideo.id === video.id ? "is-current" : ""}>
                <span>{index + 1}</span>
                <div>
                  <strong>{video.title}</strong>
                  <small>{video.category}・{formatTime(video.durationSeconds)}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </aside>

      <section className="player-area" ref={playerRef}>
        <div className="player-toolbar">
          <div>
            <p>{program.title}</p>
            <h2>{currentVideo.title}</h2>
          </div>
          <div className="toolbar-actions">
            <button type="button" onClick={() => setIsPlaying((value) => !value)}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              {isPlaying ? "暫停" : "播放"}
            </button>
            <button type="button" onClick={goNext}>
              <SkipForward size={20} />
              下一支
            </button>
            <button type="button" onClick={restart}>
              <RotateCcw size={20} />
              重播本組
            </button>
            <button type="button" onClick={openFullscreen}>
              <Maximize2 size={20} />
              全螢幕
            </button>
          </div>
        </div>

        <div className="video-frame">
          {!hasStarted ? (
            <div className="start-overlay">
              <div>
                <span className="pill">門診電視播放模式</span>
                <h2>開始自動輪播</h2>
                <p>
                  點一次後，系統會依照影片片長自動切換下一支，播完 {programRounds} 輪後回到第一支繼續循環。
                </p>
                <button type="button" onClick={startContinuousPlay}>
                  <Play size={24} />
                  開始自動輪播
                </button>
              </div>
            </div>
          ) : currentVideo.type === "mp4" ? (
            <video
              key={`${currentVideo.id}-${currentVideo.round}`}
              ref={videoRef}
              src={currentVideo.src}
              muted
              playsInline
              controls
              onEnded={goNext}
            />
          ) : (
            <iframe
              key={`${currentVideo.id}-${currentVideo.round}`}
              src={sourceFor(currentVideo, hasStarted && isPlaying)}
              title={currentVideo.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>

        <div className="now-playing">
          <div>
            <span className="pill">{currentVideo.category}</span>
            <span className="pill">第 {currentVideo.round} 輪 / 共 {programRounds} 輪</span>
            <span className="pill">本輪第 {currentVideo.programIndex} 支</span>
          </div>
          <div className="countdown">
            <small>本支估計剩餘</small>
            <strong>{formatTime(secondsLeft)}</strong>
          </div>
        </div>

        <p className="note">
          目前片長為估計值。YouTube、台大媒體與 Google Drive 影片可能受到來源網站播放權限或自動播放限制影響；若某支影片無法自動播放，可使用「下一支」繼續輪播。
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<ProgramPlayer />);
