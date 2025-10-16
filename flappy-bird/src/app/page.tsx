"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import styles from "./page.module.css";

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 640;
const GROUND_HEIGHT = 90;
const BIRD_X = CANVAS_WIDTH * 0.28;
const BIRD_RADIUS = 16;
const GRAVITY = 1800;
const FLAP_STRENGTH = -620;
const MAX_DROP_SPEED = 820;
const PIPE_WIDTH = 78;
const PIPE_GAP = 155;
const PIPE_SPEED = 180;
const PIPE_INTERVAL = 1.45;

type Pipe = {
  x: number;
  gapCenter: number;
  passed: boolean;
};

type GameState = {
  birdY: number;
  birdVelocity: number;
  pipes: Pipe[];
  spawnTimer: number;
  lastTime: number;
  running: boolean;
  wingTimer: number;
};

function createInitialState(): GameState {
  return {
    birdY: CANVAS_HEIGHT / 2,
    birdVelocity: 0,
    pipes: [],
    spawnTimer: 0,
    lastTime: 0,
    running: false,
    wingTimer: 0,
  };
}

function randomGapCenter() {
  const min = PIPE_GAP / 2 + 40;
  const max = CANVAS_HEIGHT - GROUND_HEIGHT - PIPE_GAP / 2 - 40;
  return min + Math.random() * (max - min);
}

function advanceState(
  state: GameState,
  dt: number,
  onScore: () => void,
  onCrash: () => void,
) {
  if (!state.running) {
    state.wingTimer += dt;
    return;
  }

  state.spawnTimer += dt;
  state.wingTimer += dt;
  state.birdVelocity += GRAVITY * dt;
  if (state.birdVelocity > MAX_DROP_SPEED) {
    state.birdVelocity = MAX_DROP_SPEED;
  }
  state.birdY += state.birdVelocity * dt;

  if (state.spawnTimer >= PIPE_INTERVAL) {
    state.spawnTimer -= PIPE_INTERVAL;
    state.pipes.push({
      x: CANVAS_WIDTH + PIPE_WIDTH,
      gapCenter: randomGapCenter(),
      passed: false,
    });
  }

  for (const pipe of state.pipes) {
    pipe.x -= PIPE_SPEED * dt;

    if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X - BIRD_RADIUS) {
      pipe.passed = true;
      onScore();
    }

    const gapTop = pipe.gapCenter - PIPE_GAP / 2;
    const gapBottom = pipe.gapCenter + PIPE_GAP / 2;
    const overlapsHorizontally =
      BIRD_X + BIRD_RADIUS > pipe.x &&
      BIRD_X - BIRD_RADIUS < pipe.x + PIPE_WIDTH;
    const hitsPipe =
      overlapsHorizontally &&
      (state.birdY - BIRD_RADIUS < gapTop ||
        state.birdY + BIRD_RADIUS > gapBottom);

    if (hitsPipe) {
      onCrash();
      return;
    }
  }

  state.pipes = state.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > -PIPE_WIDTH);

  const ceilingHit = state.birdY - BIRD_RADIUS <= 0;
  const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;
  const groundHit = state.birdY + BIRD_RADIUS >= groundY;

  if (ceilingHit) {
    state.birdY = BIRD_RADIUS;
    state.birdVelocity = 0;
    onCrash();
    return;
  }

  if (groundHit) {
    state.birdY = groundY - BIRD_RADIUS;
    state.birdVelocity = 0;
    onCrash();
  }
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  status: "idle" | "running" | "over",
) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  sky.addColorStop(0, "#70d8ff");
  sky.addColorStop(1, "#d5f4ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.beginPath();
  ctx.ellipse(90, 120, 55, 25, 0, 0, Math.PI * 2);
  ctx.ellipse(130, 100, 45, 20, 0, 0, Math.PI * 2);
  ctx.ellipse(260, 150, 60, 28, 0, 0, Math.PI * 2);
  ctx.ellipse(310, 135, 50, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#abebb3";
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT - GROUND_HEIGHT - 80);
  ctx.quadraticCurveTo(
    CANVAS_WIDTH * 0.3,
    CANVAS_HEIGHT - GROUND_HEIGHT - 140,
    CANVAS_WIDTH * 0.55,
    CANVAS_HEIGHT - GROUND_HEIGHT - 90,
  );
  ctx.quadraticCurveTo(
    CANVAS_WIDTH * 0.85,
    CANVAS_HEIGHT - GROUND_HEIGHT - 130,
    CANVAS_WIDTH,
    CANVAS_HEIGHT - GROUND_HEIGHT - 70,
  );
  ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_HEIGHT);
  ctx.lineTo(0, CANVAS_HEIGHT - GROUND_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#5bd155";
  ctx.strokeStyle = "#3aa840";
  ctx.lineWidth = 6;

  for (const pipe of state.pipes) {
    const gapTop = pipe.gapCenter - PIPE_GAP / 2;
    const gapBottom = pipe.gapCenter + PIPE_GAP / 2;

    ctx.fillRect(pipe.x, -6, PIPE_WIDTH, gapTop + 6);
    ctx.fillRect(pipe.x - 6, gapTop - 26, PIPE_WIDTH + 12, 26);
    ctx.strokeRect(pipe.x, -6, PIPE_WIDTH, gapTop + 6);
    ctx.strokeRect(pipe.x - 6, gapTop - 26, PIPE_WIDTH + 12, 26);

    const bottomHeight = CANVAS_HEIGHT - GROUND_HEIGHT - gapBottom;
    ctx.fillRect(pipe.x, gapBottom, PIPE_WIDTH, bottomHeight + 6);
    ctx.fillRect(pipe.x - 6, gapBottom, PIPE_WIDTH + 12, 26);
    ctx.strokeRect(pipe.x, gapBottom, PIPE_WIDTH, bottomHeight + 6);
    ctx.strokeRect(pipe.x - 6, gapBottom, PIPE_WIDTH + 12, 26);
  }

  ctx.fillStyle = "#f0c878";
  ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
  ctx.fillStyle = "#e5ba66";
  for (let i = 0; i < CANVAS_WIDTH; i += 28) {
    ctx.fillRect(i, CANVAS_HEIGHT - GROUND_HEIGHT + 40, 18, 24);
  }

  const wingOscillation = Math.sin(state.wingTimer * 12) * 4;
  const angle =
    status === "running"
      ? Math.max(-0.5, Math.min(state.birdVelocity / 600, 0.7))
      : status === "over"
        ? 0.85
        : -0.2;

  ctx.save();
  ctx.translate(BIRD_X, state.birdY);
  ctx.rotate(angle);

  ctx.fillStyle = "#ffe88a";
  ctx.beginPath();
  ctx.ellipse(4, 0, BIRD_RADIUS + 6, BIRD_RADIUS, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f7cb4e";
  ctx.beginPath();
  ctx.ellipse(
    -6,
    wingOscillation,
    BIRD_RADIUS * 0.9,
    BIRD_RADIUS * 0.65,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = "#ff9f43";
  ctx.beginPath();
  ctx.moveTo(BIRD_RADIUS + 4, -4);
  ctx.lineTo(BIRD_RADIUS + 20, 0);
  ctx.lineTo(BIRD_RADIUS + 4, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(BIRD_RADIUS - 2, -BIRD_RADIUS / 2.6, BIRD_RADIUS / 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f2937";
  ctx.beginPath();
  ctx.arc(BIRD_RADIUS + 2, -BIRD_RADIUS / 2.6, BIRD_RADIUS / 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const gameRef = useRef<GameState>(createInitialState());
  const scoreRef = useRef(0);
  const bestRef = useRef(0);

  const [status, setStatus] = useState<"idle" | "running" | "over">("idle");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem("flappy-bird-best");
    if (stored) {
      const parsed = Number(stored);
      if (!Number.isNaN(parsed) && parsed > 0) {
        bestRef.current = parsed;
        setBestScore(parsed);
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    drawScene(ctx, gameRef.current, status);
  }, [status]);

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);

  const incrementScore = useCallback(() => {
    setScore((prev) => {
      const next = prev + 1;
      scoreRef.current = next;

      if (next > bestRef.current) {
        bestRef.current = next;
        setBestScore(next);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("flappy-bird-best", String(next));
        }
      }

      return next;
    });
  }, [setBestScore]);

  const endGame = useCallback(() => {
    const state = gameRef.current;
    if (!state.running) {
      return;
    }
    state.running = false;
    state.lastTime = 0;
    setStatus("over");
  }, []);

  const step = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const state = gameRef.current;

      if (!state.running) {
        drawScene(ctx, state, status);
        return;
      }

      if (!state.lastTime) {
        state.lastTime = time;
      }

      const delta = Math.min((time - state.lastTime) / 1000, 0.05);
      state.lastTime = time;

      advanceState(state, delta, incrementScore, endGame);
      drawScene(ctx, state, state.running ? "running" : "over");

      if (state.running) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        animationRef.current = null;
      }
    },
    [endGame, incrementScore, status],
  );

  const startGame = useCallback(
    (withFlap = false) => {
      const fresh = createInitialState();
      fresh.running = true;
      if (withFlap) {
        fresh.birdVelocity = FLAP_STRENGTH;
      }

      gameRef.current = fresh;
      scoreRef.current = 0;
      setStatus("running");
      setScore(0);

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          drawScene(ctx, fresh, "running");
        }
      }

      animationRef.current = requestAnimationFrame(step);
    },
    [step],
  );

  const handleFlap = useCallback(() => {
    if (status !== "running") {
      startGame(true);
      return;
    }

    const state = gameRef.current;
    state.birdVelocity = FLAP_STRENGTH;
  }, [startGame, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        handleFlap();
      } else if (event.code === "KeyR") {
        event.preventDefault();
        startGame();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleFlap, startGame]);

  const onMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      handleFlap();
    },
    [handleFlap],
  );

  const onTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      event.preventDefault();
      handleFlap();
    },
    [handleFlap],
  );

  const onKeyDownContainer = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleFlap();
      }
    },
    [handleFlap],
  );

  const overlayVisible = status !== "running";
  const overlayTitle = status === "over" ? "Game Over" : "Flappy Bird";
  const overlayText =
    status === "over"
      ? `You scored ${score} point${score === 1 ? "" : "s"}. Tap or press space to try again.`
      : "Click, tap, or press space to start flying. Thread the bird through the gaps to earn points.";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Flappy Bird</h1>
        <p className={styles.subtitle}>
          A crisp, canvas-powered remake built with Next.js. Keep flapping to
          squeeze through the pipes and beat your best score.
        </p>
      </header>

      <div
        className={styles.gameShell}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onKeyDown={onKeyDownContainer}
        role="button"
        tabIndex={0}
        aria-label="Flappy Bird game canvas"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={styles.canvas}
        />

        <div className={styles.scoreboard} aria-live="polite">
          <span>
            <small>Score</small>
            <strong>{score}</strong>
          </span>
          <span>
            <small>Best</small>
            <strong>{bestScore}</strong>
          </span>
        </div>

        <div
          className={styles.overlay}
          data-visible={overlayVisible ? "true" : "false"}
        >
          <div className={styles.overlayCard}>
            <span className={styles.overlayTitle}>{overlayTitle}</span>
            <p className={styles.overlayText}>{overlayText}</p>
            {status === "over" ? (
              <div className={styles.controls}>
                <span>Space / Click / Tap</span>
                <span>R to Restart</span>
              </div>
            ) : (
              <div className={styles.controls}>
                <span>Space</span>
                <span>Click</span>
                <span>Tap</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        Stay in the air by timing your flaps and slipping through each gap.
        Missing even once will send you back to the start.
      </footer>
    </div>
  );
}
