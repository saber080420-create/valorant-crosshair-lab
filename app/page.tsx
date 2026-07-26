"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TestId = "reaction" | "flick" | "micro" | "visibility" | "tracking";
type ReactionPhase = "idle" | "countdown" | "wait" | "ready" | "done";
type AimPhase = "idle" | "countdown" | "running" | "done";
type Shape = "专注十字" | "稳健十字" | "追踪十字" | "极简圆点" | "空心准星" | "猪猪准星";
type Point = { x: number; y: number };
type AimResult = { times: number[]; hits: number; misses: number; efficiency: number[] };
type VisibilityResult = { times: number[]; misses: number };
type Scores = {
  reaction: number;
  flick: number;
  micro: number;
  tracking: number;
  recognition: number;
  consistency: number;
};
type Plan = {
  name: string;
  subtitle: string;
  shape: Shape;
  length: number;
  thickness: number;
  gap: number;
  outline: boolean;
  dot: boolean;
  color: string;
  outer: boolean;
  outerLength: number;
  outerThickness: number;
  outerGap: number;
  movementError: boolean;
  firingError: boolean;
  profileCode?: string;
};
type HistoryRecord = {
  date: string;
  edpi: number;
  weapon: string;
  scores: Scores;
  confidence: number;
  code: string;
  shape?: Shape;
  overall?: number;
};
type EasterEgg = { kind: "repeat"; previousShape: Shape } | { kind: "roast" };
type WeaponTuning = {
  archetype: string;
  length: number;
  gap: number;
  thickness: number;
  dotBias: boolean;
  outerLines: boolean;
  firingGuide: boolean;
  reason: string;
};

const SCORE_KEYS: (keyof Scores)[] = ["reaction", "flick", "micro", "tracking", "recognition", "consistency"];
const SCORE_LABELS: Record<keyof Scores, string> = {
  reaction: "反应",
  flick: "甩枪",
  micro: "微调",
  tracking: "跟枪",
  recognition: "辨识",
  consistency: "一致",
};
const PIGGY_PROFILE_CODE = "0;c;1;P;c;8;u;FF2385FF;h;0;d;1;b;1;z;1;f;0;0t;1;0l;5;0o;0;0a;1;0f;0;1t;3;1l;3;1o;0;1a;1;1f;0;1s;0.064";

const TESTS: { id: TestId; tag: string; title: string; description: string; metric: string }[] = [
  { id: "reaction", tag: "NEURAL // 01", title: "神经反应", description: "捕捉信号出现到完成点击的完整延迟，建立你的反应基线。", metric: "5 回合" },
  { id: "flick", tag: "ACQUIRE // 02", title: "目标获取", description: "跨越不同距离完成精准首发，分析速度、命中与运动路径。", metric: "18 目标" },
  { id: "micro", tag: "CONTROL // 03", title: "微操控制", description: "在极小范围内完成终点修正，测量手部控制的真实上限。", metric: "14 目标" },
  { id: "visibility", tag: "VISION // 04", title: "战场辨识", description: "穿过不同明暗与色相环境，锁定最适合你的视觉信号。", metric: "10 场景" },
  { id: "tracking", tag: "TRACK // 05", title: "动态追踪", description: "持续锁定非线性移动目标，计算准星与目标的实时偏差。", metric: "12 秒" },
];

const WEAPONS = ["Vandal", "Phantom", "Guardian", "Sheriff", "Operator", "Spectre", "Odin"];
const WEAPON_TUNING: Record<string, WeaponTuning> = {
  Vandal: { archetype: "首发爆头", length: 0, gap: -1, thickness: 0, dotBias: false, outerLines: false, firingGuide: false, reason: "收紧中心间隙，强化首发爆头与短连发定位" },
  Phantom: { archetype: "连发控枪", length: 1, gap: 0, thickness: 0, dotBias: false, outerLines: true, firingGuide: true, reason: "增加外线参照，兼顾近中距离连续控枪" },
  Guardian: { archetype: "精密点射", length: -1, gap: -1, thickness: 0, dotBias: true, outerLines: false, firingGuide: false, reason: "缩短线条并加入中心点，突出单发精度" },
  Sheriff: { archetype: "手枪首发", length: 0, gap: -1, thickness: 0, dotBias: true, outerLines: false, firingGuide: false, reason: "保留清晰中心点，降低甩枪落点遮挡" },
  Operator: { archetype: "狙击预瞄", length: -2, gap: 0, thickness: 0, dotBias: true, outerLines: false, firingGuide: false, reason: "压缩非开镜准星体积，服务架点与开镜前预瞄" },
  Spectre: { archetype: "移动近战", length: 1, gap: 1, thickness: 0, dotBias: false, outerLines: true, firingGuide: true, reason: "扩大近距离中心参照，并开启连射修正外线" },
  Odin: { archetype: "持续压枪", length: 2, gap: 1, thickness: 1, dotBias: false, outerLines: true, firingGuide: true, reason: "加粗并延长准星线，强化持续扫射时的方向反馈" },
};
const COLORS = ["#00F0FF", "#65FF77", "#FFD84D", "#FF5DA2", "#FFFFFF", "#9B7BFF"];
const SCENES = [
  { background: "linear-gradient(135deg,#78918c,#314c4a)", target: "#ff4655" },
  { background: "linear-gradient(135deg,#c5ad87,#78664e)", target: "#00efff" },
  { background: "linear-gradient(135deg,#77718c,#312e45)", target: "#d7ff52" },
  { background: "linear-gradient(135deg,#b7c3ca,#66757d)", target: "#ff3b69" },
  { background: "linear-gradient(135deg,#594b45,#181b20)", target: "#75ff76" },
];

const emptyAim = (): AimResult => ({ times: [], hits: 0, misses: 0, efficiency: [] });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const deviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const randomPoint = (margin = 12): Point => ({
  x: margin + Math.random() * (100 - margin * 2),
  y: margin + Math.random() * (100 - margin * 2),
});
const nearCenterPoint = (): Point => {
  const angle = Math.random() * Math.PI * 2;
  const radius = 8 + Math.random() * 18;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
};

export default function Home() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [heroPointer, setHeroPointer] = useState({ x: 0, y: 0 });
  const [dpi, setDpi] = useState(800);
  const [sensitivity, setSensitivity] = useState(0.32);
  const [resolution, setResolution] = useState("1920 × 1080");
  const [weapon, setWeapon] = useState("Vandal");
  const [style, setStyle] = useState("点射 / 短连发");
  const [range, setRange] = useState("中距离");

  const [reactionPhase, setReactionPhase] = useState<ReactionPhase>("idle");
  const [reactionCountdown, setReactionCountdown] = useState(3);
  const [reactionResults, setReactionResults] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const reactionReadyAt = useRef(0);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [aimTest, setAimTest] = useState<"flick" | "micro" | null>(null);
  const [aimPhase, setAimPhase] = useState<AimPhase>("idle");
  const [aimCountdown, setAimCountdown] = useState(3);
  const [target, setTarget] = useState<Point>({ x: 50, y: 50 });
  const [flickResult, setFlickResult] = useState<AimResult>(emptyAim);
  const [microResult, setMicroResult] = useState<AimResult>(emptyAim);
  const aimResultRef = useRef<AimResult>(emptyAim());
  const targetAt = useRef(0);
  const targetOrigin = useRef<Point>({ x: 50, y: 50 });
  const lastPointer = useRef<Point>({ x: 50, y: 50 });
  const pathTravel = useRef(0);

  const [visibilityPhase, setVisibilityPhase] = useState<AimPhase>("idle");
  const [visibilityCountdown, setVisibilityCountdown] = useState(3);
  const [visibilityTarget, setVisibilityTarget] = useState<Point>({ x: 50, y: 50 });
  const [visibilityScene, setVisibilityScene] = useState(0);
  const [visibilityResult, setVisibilityResult] = useState<VisibilityResult>({ times: [], misses: 0 });
  const visibilityAt = useRef(0);

  const [trackingPhase, setTrackingPhase] = useState<AimPhase>("idle");
  const [trackingCountdown, setTrackingCountdown] = useState(3);
  const [trackingTime, setTrackingTime] = useState(12);
  const [trackingTarget, setTrackingTarget] = useState<Point>({ x: 50, y: 50 });
  const [trackingCursor, setTrackingCursor] = useState<Point>({ x: 50, y: 50 });
  const [trackingSamples, setTrackingSamples] = useState<number[]>([]);
  const trackingCursorRef = useRef<Point>({ x: 50, y: 50 });
  const trackingEnd = useRef(0);

  const [generated, setGenerated] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(0);
  const [color, setColor] = useState("#00F0FF");
  const [copied, setCopied] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);
  const [easterEgg, setEasterEgg] = useState<EasterEgg | null>(null);
  const [pointToCrosshair, setPointToCrosshair] = useState(false);

  const edpi = Math.round(dpi * sensitivity);
  const completed = [
    reactionPhase === "done",
    flickResult.hits >= 18,
    microResult.hits >= 14,
    visibilityResult.times.length >= 10,
    trackingPhase === "done",
  ].filter(Boolean).length;

  const scheduleReaction = useCallback(() => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    setReactionPhase("wait");
    reactionTimer.current = setTimeout(() => {
      reactionReadyAt.current = performance.now();
      setReactionPhase("ready");
    }, 900 + Math.random() * 1900);
  }, []);

  useEffect(() => {
    if (reactionPhase !== "countdown") return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const next = Math.max(0, 3 - Math.floor((performance.now() - started) / 1000));
      setReactionCountdown(next);
      if (next === 0) {
        window.clearInterval(timer);
        scheduleReaction();
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [reactionPhase, scheduleReaction]);

  useEffect(() => {
    if (aimPhase !== "countdown" || !aimTest) return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const next = Math.max(0, 3 - Math.floor((performance.now() - started) / 1000));
      setAimCountdown(next);
      if (next === 0) {
        window.clearInterval(timer);
        const first = aimTest === "micro" ? nearCenterPoint() : randomPoint();
        setTarget(first);
        targetOrigin.current = { x: 50, y: 50 };
        lastPointer.current = { x: 50, y: 50 };
        pathTravel.current = 0;
        targetAt.current = performance.now();
        setAimPhase("running");
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [aimPhase, aimTest]);

  useEffect(() => {
    if (visibilityPhase !== "countdown") return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const next = Math.max(0, 3 - Math.floor((performance.now() - started) / 1000));
      setVisibilityCountdown(next);
      if (next === 0) {
        window.clearInterval(timer);
        setVisibilityTarget(randomPoint(16));
        visibilityAt.current = performance.now();
        setVisibilityPhase("running");
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [visibilityPhase]);

  useEffect(() => {
    if (trackingPhase !== "countdown") return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const next = Math.max(0, 3 - Math.floor((performance.now() - started) / 1000));
      setTrackingCountdown(next);
      if (next === 0) {
        window.clearInterval(timer);
        trackingEnd.current = performance.now() + 12_000;
        setTrackingTime(12);
        setTrackingSamples([]);
        setTrackingPhase("running");
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [trackingPhase]);

  useEffect(() => {
    if (trackingPhase !== "running") return;
    let frame = 0;
    let sampleAt = 0;
    const animate = (now: number) => {
      const left = trackingEnd.current - now;
      if (left <= 0) {
        setTrackingTime(0);
        setTrackingPhase("done");
        return;
      }
      setTrackingTime(Math.ceil(left / 1000));
      const elapsed = 12_000 - left;
      const next = {
        x: 50 + Math.sin(elapsed / 720) * 32 + Math.sin(elapsed / 230) * 5,
        y: 50 + Math.cos(elapsed / 960) * 23 + Math.sin(elapsed / 310) * 6,
      };
      setTrackingTarget(next);
      if (now - sampleAt > 50) {
        sampleAt = now;
        setTrackingSamples((items) => [...items, distance(trackingCursorRef.current, next)]);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [trackingPhase]);

  useEffect(() => () => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
  }, []);

  useEffect(() => {
    const update = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(available > 0 ? window.scrollY / available : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  function startReaction() {
    setReactionResults([]);
    setFalseStarts(0);
    setReactionCountdown(3);
    setReactionPhase("countdown");
  }

  function handleReaction() {
    if (reactionPhase === "wait") {
      setFalseStarts((value) => value + 1);
      scheduleReaction();
      return;
    }
    if (reactionPhase !== "ready") return;
    const next = [...reactionResults, Math.round(performance.now() - reactionReadyAt.current)];
    setReactionResults(next);
    if (next.length >= 5) setReactionPhase("done");
    else scheduleReaction();
  }

  function startAim(id: "flick" | "micro") {
    setAimTest(id);
    setAimCountdown(3);
    const empty = emptyAim();
    aimResultRef.current = empty;
    if (id === "flick") setFlickResult(empty);
    else setMicroResult(empty);
    setAimPhase("countdown");
  }

  function updateAimPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (aimPhase !== "running") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
    pathTravel.current += distance(lastPointer.current, next);
    lastPointer.current = next;
  }

  function hitAim(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (aimPhase !== "running" || !aimTest) return;
    const limit = aimTest === "micro" ? 14 : 18;
    const direct = Math.max(1, distance(targetOrigin.current, target));
    const efficiency = clamp(direct / Math.max(direct, pathTravel.current), 0, 1);
    const next: AimResult = {
      ...aimResultRef.current,
      hits: aimResultRef.current.hits + 1,
      times: [...aimResultRef.current.times, Math.round(performance.now() - targetAt.current)],
      efficiency: [...aimResultRef.current.efficiency, efficiency],
    };
    aimResultRef.current = next;
    if (aimTest === "flick") setFlickResult(next);
    else setMicroResult(next);
    if (next.hits >= limit) {
      setAimPhase("done");
      return;
    }
    const origin = target;
    const nextTarget = aimTest === "micro" ? nearCenterPoint() : randomPoint();
    targetOrigin.current = origin;
    lastPointer.current = target;
    pathTravel.current = 0;
    setTarget(nextTarget);
    targetAt.current = performance.now();
  }

  function missAim() {
    if (aimPhase !== "running" || !aimTest) return;
    const next = { ...aimResultRef.current, misses: aimResultRef.current.misses + 1 };
    aimResultRef.current = next;
    if (aimTest === "flick") setFlickResult(next);
    else setMicroResult(next);
  }

  function startVisibility() {
    setVisibilityResult({ times: [], misses: 0 });
    setVisibilityScene(Math.floor(Math.random() * SCENES.length));
    setVisibilityCountdown(3);
    setVisibilityPhase("countdown");
  }

  function hitVisibility(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (visibilityPhase !== "running") return;
    const times = [...visibilityResult.times, Math.round(performance.now() - visibilityAt.current)];
    setVisibilityResult((current) => ({ ...current, times }));
    if (times.length >= 10) {
      setVisibilityPhase("done");
      return;
    }
    setVisibilityScene((value) => (value + 1 + Math.floor(Math.random() * 4)) % SCENES.length);
    setVisibilityTarget(randomPoint(16));
    visibilityAt.current = performance.now();
  }

  function moveTracking(event: React.PointerEvent<HTMLDivElement>) {
    if (trackingPhase !== "running") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
    trackingCursorRef.current = next;
    setTrackingCursor(next);
  }

  const scores: Scores = useMemo(() => {
    const reactionMean = average(reactionResults);
    const reactionScore = reactionMean ? clamp(110 - (reactionMean - 170) * 0.22 - falseStarts * 5, 10, 100) : 0;
    const aimScore = (result: AimResult, expected: number, strictness: number) => {
      if (!result.hits) return 0;
      const accuracy = result.hits / Math.max(1, result.hits + result.misses);
      const missRatio = result.misses / Math.max(1, result.hits + result.misses);
      const missPenalty = Math.pow(missRatio, 1.35) * 92;
      return clamp(100 - (average(result.times) - expected) * strictness + (accuracy - 0.82) * 38 + (average(result.efficiency) - 0.65) * 31 - missPenalty, 4, 100);
    };
    const trackMean = average(trackingSamples);
    const consistencyValues = [
      reactionResults.length ? clamp(100 - deviation(reactionResults) * 0.8, 0, 100) : 0,
      flickResult.times.length ? clamp(100 - deviation(flickResult.times) * 0.12, 0, 100) : 0,
      microResult.times.length ? clamp(100 - deviation(microResult.times) * 0.12, 0, 100) : 0,
    ].filter(Boolean);
    return {
      reaction: Math.round(reactionScore),
      flick: Math.round(aimScore(flickResult, 620, 0.11)),
      micro: Math.round(aimScore(microResult, 520, 0.14)),
      tracking: trackingSamples.length ? Math.round(clamp(108 - trackMean * 3.25, 4, 100)) : 0,
      recognition: visibilityResult.times.length
        ? Math.round(clamp(110 - (average(visibilityResult.times) - 260) * 0.12 - visibilityResult.misses * 6.5, 4, 100))
        : 0,
      consistency: consistencyValues.length ? Math.round(average(consistencyValues)) : 0,
    };
  }, [reactionResults, falseStarts, flickResult, microResult, trackingSamples, visibilityResult]);

  const overallScore = Math.round(
    scores.reaction * .08 +
    scores.flick * .23 +
    scores.micro * .24 +
    scores.tracking * .18 +
    scores.recognition * .14 +
    scores.consistency * .13
  );
  const totalMisses = flickResult.misses + microResult.misses + visibilityResult.misses + falseStarts;
  const poorPerformance = completed === 5 && overallScore < 65;
  const weaponTuning = WEAPON_TUNING[weapon];

  const plans: Plan[] = useMemo(() => {
    if (poorPerformance) {
      return ["主推荐", "竞技极简", "高辨识度"].map((name, index) => ({
        name,
        subtitle: index === 0 ? "老苗认证 · 猪猪专属" : "别挑了 · 都是猪猪",
        shape: "猪猪准星" as Shape,
        length: 5,
        thickness: 1,
        gap: 0,
        outline: false,
        dot: true,
        color: "#FF2385",
        outer: true,
        outerLength: 3,
        outerThickness: 3,
        outerGap: 0,
        movementError: false,
        firingError: false,
        profileCode: PIGGY_PROFILE_CODE,
      }));
    }

    const precise = scores.micro >= 76 && scores.consistency >= 70 && totalMisses <= 5;
    const needsVisibility = scores.recognition < 66;
    const trackingWeak = scores.tracking < 60;
    const highEdpi = edpi > 400;
    const lowEdpi = edpi < 220;
    const distanceGap = range === "远距离" ? -1 : range === "近距离" ? 1 : 0;
    const baseGap = clamp(2 + distanceGap + weaponTuning.gap + (highEdpi ? 1 : 0) - (lowEdpi ? 1 : 0), 0, 5);
    const baseLength = clamp(4 + weaponTuning.length + (scores.flick < 60 ? 1 : 0) + (trackingWeak ? 1 : 0) - (scores.flick > 82 ? 1 : 0), 1, 7);
    const mainShape: Shape = precise && weaponTuning.dotBias
      ? "极简圆点"
      : trackingWeak || weaponTuning.outerLines
        ? "追踪十字"
        : scores.consistency < 58
          ? "稳健十字"
          : "专注十字";
    return [
      {
        name: "主推荐",
        subtitle: `${weapon} · ${weaponTuning.archetype}`,
        shape: mainShape,
        length: baseLength,
        thickness: clamp((needsVisibility ? 2 : 1) + weaponTuning.thickness, 1, 3),
        gap: baseGap,
        outline: needsVisibility,
        dot: (weaponTuning.dotBias && scores.micro >= 62) || precise || (scores.reaction > 82 && scores.flick > 76),
        color: needsVisibility ? "#65FF77" : "#00F0FF",
        outer: trackingWeak || weaponTuning.outerLines,
        outerLength: trackingWeak ? 2 : 1,
        outerThickness: 1,
        outerGap: baseGap + 3,
        movementError: style === "移动跟枪",
        firingError: weaponTuning.firingGuide && (style === "扫射压枪" || scores.tracking < 60),
      },
      {
        name: trackingWeak ? "稳定修正" : "竞技极简",
        subtitle: trackingWeak ? "放大中心参照降低跟丢" : "首发定位与远距离对枪",
        shape: (trackingWeak ? "稳健十字" : precise ? "极简圆点" : "专注十字") as Shape,
        length: trackingWeak ? 6 : clamp(baseLength - 1, 2, 5),
        thickness: needsVisibility ? 2 : 1,
        gap: trackingWeak ? clamp(baseGap + 1, 1, 5) : clamp(baseGap - 1, 0, 3),
        outline: needsVisibility,
        dot: precise,
        color: needsVisibility ? "#65FF77" : "#00F0FF",
        outer: false,
        outerLength: 0,
        outerThickness: 0,
        outerGap: 0,
        movementError: false,
        firingError: false,
      },
      {
        name: "武器特化",
        subtitle: `${weapon} · ${weaponTuning.reason}`,
        shape: (weaponTuning.dotBias && scores.micro >= 62 ? "极简圆点" : weaponTuning.outerLines ? "追踪十字" : "空心准星") as Shape,
        length: clamp(3 + weaponTuning.length, 1, 6),
        thickness: clamp(1 + weaponTuning.thickness + (needsVisibility ? 1 : 0), 1, 3),
        gap: clamp(2 + weaponTuning.gap, 0, 4),
        outline: true,
        dot: weaponTuning.dotBias,
        color: needsVisibility ? "#65FF77" : "#9B7BFF",
        outer: weaponTuning.outerLines,
        outerLength: weaponTuning.outerLines ? 2 : 0,
        outerThickness: 1,
        outerGap: baseGap + 4,
        movementError: false,
        firingError: weaponTuning.firingGuide,
      },
    ];
  }, [scores, range, edpi, weapon, weaponTuning, style, totalMisses, poorPerformance]);

  const plan = plans[selectedPlan];
  const confidence = Math.round(clamp(
    55 + completed * 7 + scores.consistency * 0.1 - falseStarts * 2,
    0,
    98,
  ));
  const reasons = useMemo(() => {
    const items = [];
    if (poorPerformance) return [
      `综合表现 ${overallScore} 分，累计失误 ${totalMisses} 次，已触发老苗的猪猪保护机制。`,
      "三套方案统一锁定为热门猪猪造型，先看清中心，再考虑极限参数。",
      "这不是羞辱，是系统在保护你的队友。",
    ];
    if (scores.micro >= 72) items.push(`微调能力 ${scores.micro} 分，适合更小的中心间隙与低遮挡造型。`);
    else items.push(`微调能力 ${scores.micro} 分，保留清晰十字线以降低修正压力。`);
    if (scores.recognition < 68) items.push(`目标辨识 ${scores.recognition} 分，已增加描边并采用高对比绿色。`);
    else items.push(`目标辨识 ${scores.recognition} 分，无需厚重描边也能保持清晰。`);
    if (scores.flick >= 74) items.push(`甩枪定位 ${scores.flick} 分，缩短线长以减少目标遮挡。`);
    else items.push(`甩枪定位 ${scores.flick} 分，稍长线条能提供更稳定的中心参照。`);
    items.push(`主武器 ${weapon}（${weaponTuning.archetype}）：${weaponTuning.reason}。`);
    items.push(`eDPI ${edpi} 与“${style}”继续修正了间隙和动态误差。`);
    return items;
  }, [scores, edpi, weapon, weaponTuning, style, poorPerformance, overallScore, totalMisses]);

  const code = useMemo(() => {
    const hex = color.replace("#", "").toUpperCase();
    if (plan.profileCode) return plan.profileCode;
    return [
      "0", "s", "1", "P", "c", "8", "u", `${hex}FF`, "b", "1",
      "h", plan.outline ? "1" : "0", "o", "1", "d", plan.dot ? "1" : "0",
      "0b", plan.shape === "极简圆点" ? "0" : "1", "0a", "1",
      "0l", String(plan.length), "0v", String(plan.length), "0t", String(plan.thickness),
      "0o", String(plan.gap), "0m", plan.movementError ? "1" : "0", "0f", plan.firingError ? "1" : "0",
      "1b", plan.outer ? "1" : "0", "1l", String(plan.outerLength), "1t", String(plan.outerThickness),
      "1o", String(plan.outerGap), "1m", plan.movementError ? "1" : "0", "1f", plan.firingError ? "1" : "0",
      "S", "c", "8", "t", `${hex}FF`, "d", "1", "o", "1",
    ].join(";");
  }, [color, plan]);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function clearTestHistory() {
    localStorage.removeItem("crosshair-lab-history");
    setEasterEgg(null);
    setPointToCrosshair(false);
    setHistoryCleared(true);
    window.setTimeout(() => setHistoryCleared(false), 1800);
  }

  function generateProfile() {
    setSelectedPlan(0);
    setColor(plans[0].color);
    setGenerated(true);
    setPointToCrosshair(false);
    let history: HistoryRecord[] = [];
    try {
      history = JSON.parse(localStorage.getItem("crosshair-lab-history") ?? "[]") as HistoryRecord[];
    } catch {
      history = [];
    }
    const previous = history[0];
    const scoreDelta = previous?.scores
      ? average(SCORE_KEYS.map((key) => Math.abs(scores[key] - previous.scores[key])))
      : Number.POSITIVE_INFINITY;
    if (poorPerformance) {
      setEasterEgg({ kind: "roast" });
      setPointToCrosshair(true);
    } else if (previous && scoreDelta <= 8) {
      const legacyShape: Shape = previous.code?.includes("0b;0") ? "极简圆点" : "专注十字";
      const previousShape = previous.shape ?? legacyShape;
      setEasterEgg(previousShape === plans[0].shape ? { kind: "repeat", previousShape } : null);
    } else {
      setEasterEgg(null);
    }
    const record: HistoryRecord = { date: new Date().toISOString(), edpi, weapon, scores, confidence, code, shape: plans[0].shape, overall: overallScore };
    localStorage.setItem("crosshair-lab-history", JSON.stringify([record, ...history].slice(0, 12)));
    window.setTimeout(() => document.querySelector("#report")?.scrollIntoView({ behavior: "smooth" }), 80);
  }

  const currentScene = SCENES[visibilityScene];

  return (
    <main>
      <div className="scroll-progress" style={{ transform: `scaleX(${scrollProgress})` }} />
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">V</span><span>CROSSLINK <small>LAB / 02</small></span></a>
        <nav><a href="#profile">作战参数</a><a href="#tests">瞄准协议</a><a href="#report">基因报告</a></nav>
        <div className="privacy"><i /> LOCAL SECURE</div>
        <button className={`clear-history ${historyCleared ? "cleared" : ""}`} onClick={clearTestHistory}>
          {historyCleared ? "测试记录已清除 ✓" : "清除测试记录"}
        </button>
      </header>

      <section className="hero" onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setHeroPointer({ x: (event.clientX - rect.left) / rect.width - .5, y: (event.clientY - rect.top) / rect.height - .5 });
      }}>
        <div className="hero-content">
          <div className="eyebrow"><span /> CROSSHAIR INTELLIGENCE SYSTEM</div>
          <h1>每一像素，<br /><em>都要有证据。</em></h1>
          <p>拒绝复制职业选手的答案。用五项瞄准协议读取你的反应、控制与视觉偏好，将真实操作习惯压缩成一枚只属于你的准星。</p>
          <div className="hero-actions">
            <a className="primary-action" href="#profile"><b>启动校准协议</b><span>↗</span></a>
            <div><b>03:00 / COMPLETE</b><span>本地运算 · 零数据上传 · 即时生成</span></div>
          </div>
          <div className="hero-specs"><span><b>05</b> AIM PROTOCOLS</span><span><b>06</b> PERFORMANCE AXES</span><span><b>03</b> TACTICAL PROFILES</span></div>
        </div>
        <div className="hero-simulator" style={{ transform: `perspective(900px) rotateY(${heroPointer.x * 7}deg) rotateX(${-heroPointer.y * 7}deg)` }}>
          <div className="sim-corners"><i /><i /><i /><i /></div>
          <div className="sim-header"><span>LIVE CALIBRATION</span><b>SYS // ONLINE</b></div>
          <div className="sim-radar"><i /><i /><i /><i /><div className="sim-cross"><span /><span /><span /><span /></div><b /></div>
          <div className="sim-readout"><span>INPUT LATENCY<strong>04.2 ms</strong></span><span>TRACKING VECTOR<strong>LOCKED</strong></span></div>
          <div className="sim-scan" />
        </div>
      </section>

      <section className="workspace" id="profile">
        <SectionHeading index="01" title="校准你的作战参数" subtitle="先读懂你的硬件与操作尺度，再开始任何判断。" />
        <div className="profile-grid">
          <NumberInput label="鼠标 DPI" value={dpi} min={100} max={6400} step={50} onChange={setDpi} />
          <NumberInput label="游戏内灵敏度" value={sensitivity} min={0.01} max={2} step={0.01} onChange={setSensitivity} decimals />
          <div className="edpi-card"><span>有效灵敏度 eDPI</span><strong>{edpi}</strong><p>{edpi < 200 ? "低敏 · 大范围手臂移动" : edpi > 400 ? "高敏 · 精细手腕控制" : "均衡 · 兼顾定位与转身"}</p></div>
          <SelectInput label="主武器" value={weapon} options={WEAPONS} onChange={setWeapon} />
          <SelectInput label="分辨率" value={resolution} options={["1920 × 1080", "2560 × 1440", "1280 × 960", "1280 × 1024"]} onChange={setResolution} />
          <SelectInput label="射击习惯" value={style} options={["点射 / 短连发", "扫射压枪", "移动跟枪"]} onChange={setStyle} />
          <SelectInput label="常用距离" value={range} options={["近距离", "中距离", "远距离"]} onChange={setRange} />
        </div>
      </section>

      <section className="workspace tests-section" id="tests">
        <SectionHeading index="02" title="建立瞄准指纹" subtitle="五项协议共同构成你的个人瞄准基因。" trailing={`${completed} / 5 PROTOCOLS`} />
        <div className="test-overview">
          {TESTS.map((test, index) => {
            const done = [
              reactionPhase === "done",
              flickResult.hits >= 18,
              microResult.hits >= 14,
              visibilityResult.times.length >= 10,
              trackingPhase === "done",
            ][index];
            return <a href={`#${test.id}`} className={done ? "done" : ""} key={test.id}><span>{String(index + 1).padStart(2, "0")}</span><b>{test.title}</b><i>{done ? "✓" : test.metric}</i></a>;
          })}
        </div>

        <TestShell id="reaction" tag={TESTS[0].tag} title={TESTS[0].title} description={TESTS[0].description}
          stat={reactionPhase === "done" ? `${Math.round(average(reactionResults))} ms` : "5 回合"}>
          <button className={`reaction-arena ${reactionPhase}`} onClick={reactionPhase === "idle" || reactionPhase === "done" ? startReaction : handleReaction}>
            {reactionPhase === "idle" && <><b>开始测试</b><span>变绿后立即点击</span></>}
            {reactionPhase === "countdown" && <b className="count">{reactionCountdown}</b>}
            {reactionPhase === "wait" && <><b>等待信号</b><span>抢点会被记录</span></>}
            {reactionPhase === "ready" && <b>现在！</b>}
            {reactionPhase === "done" && <><b>{Math.round(average(reactionResults))} ms</b><span>波动 {Math.round(deviation(reactionResults))} ms · 抢点 {falseStarts} 次 · 点击重测</span></>}
          </button>
          <div className="trial-row">{[0,1,2,3,4].map((item) => <span className={reactionResults[item] ? "complete" : ""} key={item}>{reactionResults[item] ? `${reactionResults[item]} ms` : `回合 ${item + 1}`}</span>)}</div>
        </TestShell>

        <TestShell id="flick" tag={TESTS[1].tag} title={TESTS[1].title} description={TESTS[1].description}
          stat={flickResult.hits >= 18 ? `${Math.round(average(flickResult.times))} ms` : `${flickResult.hits} / 18`}>
          <AimArena id="flick" active={aimTest === "flick"} phase={aimTest === "flick" ? aimPhase : "idle"} countdown={aimCountdown}
            target={target} targetSize={42} hits={flickResult.hits} limit={18}
            onStart={() => startAim("flick")} onMove={updateAimPointer} onMiss={missAim} onHit={hitAim} />
          <TestMetrics result={flickResult} />
        </TestShell>

        <TestShell id="micro" tag={TESTS[2].tag} title={TESTS[2].title} description={TESTS[2].description}
          stat={microResult.hits >= 14 ? `${Math.round(average(microResult.times))} ms` : `${microResult.hits} / 14`}>
          <AimArena id="micro" active={aimTest === "micro"} phase={aimTest === "micro" ? aimPhase : "idle"} countdown={aimCountdown}
            target={target} targetSize={25} hits={microResult.hits} limit={14}
            onStart={() => startAim("micro")} onMove={updateAimPointer} onMiss={missAim} onHit={hitAim} micro />
          <TestMetrics result={microResult} />
        </TestShell>

        <TestShell id="visibility" tag={TESTS[3].tag} title={TESTS[3].title} description={TESTS[3].description}
          stat={visibilityResult.times.length >= 10 ? `${Math.round(average(visibilityResult.times))} ms` : `${visibilityResult.times.length} / 10`}>
          <div className={`visibility-arena ${visibilityPhase}`} style={{ background: currentScene.background }} onClick={() => visibilityPhase === "running" && setVisibilityResult((value) => ({ ...value, misses: value.misses + 1 }))}>
            {(visibilityPhase === "idle" || visibilityPhase === "done") && <button className="arena-start" onClick={startVisibility}><b>{visibilityPhase === "done" ? "重新测试" : "开始辨识"}</b><span>点击场景中出现的小目标</span></button>}
            {visibilityPhase === "countdown" && <div className="arena-count"><b>{visibilityCountdown}</b><span>注意不同背景</span></div>}
            {visibilityPhase === "running" && <button aria-label="目标" className="visibility-target" style={{ left: `${visibilityTarget.x}%`, top: `${visibilityTarget.y}%`, background: currentScene.target }} onClick={hitVisibility} />}
            <div className="scene-label">SCENE {visibilityResult.times.length + 1 > 10 ? 10 : visibilityResult.times.length + 1} / 10</div>
          </div>
          <div className="metric-line"><span>平均识别 <b>{visibilityResult.times.length ? `${Math.round(average(visibilityResult.times))} ms` : "—"}</b></span><span>误点 <b>{visibilityResult.misses}</b></span></div>
        </TestShell>

        <TestShell id="tracking" tag={TESTS[4].tag} title={TESTS[4].title} description={TESTS[4].description}
          stat={trackingPhase === "done" ? `${Math.round(average(trackingSamples) * 10) / 10}% 偏差` : `${trackingTime} 秒`}>
          <div className={`tracking-arena ${trackingPhase}`} onPointerMove={moveTracking}>
            {(trackingPhase === "idle" || trackingPhase === "done") && <button className="arena-start" onClick={() => { setTrackingCountdown(3); setTrackingPhase("countdown"); }}><b>{trackingPhase === "done" ? "重新测试" : "开始跟枪"}</b><span>用隐藏准星持续跟随移动目标</span></button>}
            {trackingPhase === "countdown" && <div className="arena-count"><b>{trackingCountdown}</b><span>准备移动鼠标</span></div>}
            {trackingPhase === "running" && <>
              <div className="tracking-target" style={{ left: `${trackingTarget.x}%`, top: `${trackingTarget.y}%` }}><i /></div>
              <div className="tracking-cursor" style={{ left: `${trackingCursor.x}%`, top: `${trackingCursor.y}%` }}><i /><i /><i /><i /></div>
              <div className="arena-hud"><span>AVG DEV {Math.round(average(trackingSamples) * 10) / 10}</span><b>00:{String(trackingTime).padStart(2, "0")}</b></div>
            </>}
          </div>
          <div className="metric-line"><span>覆盖率 <b>{trackingSamples.length ? `${Math.round(trackingSamples.filter((value) => value < 5).length / trackingSamples.length * 100)}%` : "—"}</b></span><span>采样 <b>{trackingSamples.length || "—"}</b></span></div>
        </TestShell>

        <button className="generate-button" disabled={completed < 5} onClick={generateProfile}>
          <span>{completed < 5 ? `还需完成 ${5 - completed} 项检测` : "生成我的完整分析报告"}</span><i>→</i>
        </button>
      </section>

      {generated && <section className="report-section" id="report">
        <div className="workspace">
          <SectionHeading index="03" title="瞄准基因解码完成" subtitle="这不是一套热门参数，而是你的操作数据留下的答案。" trailing={`CONFIDENCE ${confidence}%`} light />
          <div className="report-grid">
            <div className="score-panel">
              <h3>六维能力评分</h3>
              <Radar scores={scores} />
              <div className="score-list">
                {Object.entries(scores).map(([key, value]) => <div key={key}><span>{scoreName(key)}</span><i><b style={{ width: `${value}%` }} /></i><strong>{value}</strong></div>)}
              </div>
            </div>
            <div className="recommendation-panel">
              <div className="plan-tabs">{plans.map((item, index) => <button className={selectedPlan === index ? "active" : ""} onClick={() => { setSelectedPlan(index); setColor(item.color); }} key={item.name}><b>{item.name}</b><span>{item.subtitle}</span></button>)}</div>
              <div className={`preview-card ${pointToCrosshair ? "is-pointed" : ""}`} id="crosshair-preview-target">
                <div className="preview-meta"><span>LIVE PREVIEW</span><b>{weapon.toUpperCase()} · {plan.shape}</b></div>
                <CrosshairPreview plan={plan} color={color} pointToCrosshair={pointToCrosshair} />
                <div className="preview-foot"><span>{resolution}</span><span>eDPI {edpi}</span></div>
              </div>
              <div className="reason-card"><h3>为什么这样推荐</h3>{reasons.map((reason, index) => <p key={reason}><b>0{index + 1}</b>{reason}</p>)}</div>
              <div className="tuning-row">
                <div><span>准星颜色</span><div className="colors">{COLORS.map((item) => <button aria-label={item} className={color === item ? "active" : ""} style={{ background: item }} onClick={() => setColor(item)} key={item} />)}</div></div>
                <div className="parameter-summary"><span>参数摘要</span><b>长度 {plan.length} · 粗细 {plan.thickness} · 间隙 {plan.gap} · 描边 {plan.outline ? "开" : "关"}</b></div>
              </div>
              <div className="code-card"><div><span>VALORANT PROFILE CODE</span><small>已根据“{style}”适配动态误差</small></div><code>{code}</code><button onClick={copyCode}>{copied ? "已复制 ✓" : "复制导入码"}</button></div>
            </div>
          </div>
        </div>
      </section>}

      {easterEgg && <div className={`easter-overlay ${easterEgg.kind}`} role="dialog" aria-modal="true" aria-labelledby="easter-title">
        <div className="easter-impact" aria-hidden="true">啪！</div>
        {easterEgg.kind === "repeat" && <div className="slap-hand" aria-hidden="true">✋</div>}
        <div className="easter-modal">
          <button className="easter-close" aria-label="关闭提示" onClick={() => setEasterEgg(null)}>×</button>
          <small>{easterEgg.kind === "repeat" ? "RETEST DETECTED // 老苗警告" : "SKILL ISSUE // 老苗裁决"}</small>
          <h2 id="easter-title">{easterEgg.kind === "repeat"
            ? <>都说了你只适合【{easterEgg.previousShape}】准星了，<br />不相信老苗的测试结果？</>
            : "得了，你这水平只适合用这个"}</h2>
          <p>{easterEgg.kind === "repeat"
            ? "本次六维数据与上次高度重合，系统拒绝陪你反复横跳。"
            : "三套方案已强制切换为猪猪准星，系统建议先和它培养感情。"}</p>
          <button className="easter-action" onClick={() => {
            setEasterEgg(null);
            if (easterEgg.kind === "roast") {
              document.querySelector("#crosshair-preview-target")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }}>{easterEgg.kind === "repeat" ? "老苗我错了" : "看看猪猪准星 →"}</button>
        </div>
      </div>}

      <footer><b>CROSSLINK / LAB 02</b><span>BUILT FOR PLAYERS · 本地运算 · 与 Riot Games 无隶属或背书关系</span></footer>
    </main>
  );
}

function SectionHeading({ index, title, subtitle, trailing, light = false }: { index: string; title: string; subtitle: string; trailing?: string; light?: boolean }) {
  return <div className={`section-heading ${light ? "light" : ""}`}><span>{index}</span><div><h2>{title}</h2><p>{subtitle}</p></div>{trailing && <strong>{trailing}</strong>}</div>;
}

function NumberInput({ label, value, min, max, step, onChange, decimals = false }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; decimals?: boolean }) {
  const commit = (input: HTMLInputElement) => {
    const parsed = Number(input.value);
    if (input.value.trim() === "" || !Number.isFinite(parsed)) {
      input.value = String(value);
      return;
    }
    const next = clamp(parsed, min, max);
    onChange(next);
    input.value = String(next);
  };
  return <label className="input-card"><span>{label}</span><div><input
    key={value}
    type="number"
    inputMode={decimals ? "decimal" : "numeric"}
    defaultValue={value}
    min={min}
    max={max}
    step={step}
    onBlur={(event) => commit(event.currentTarget)}
    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
  /><small>{decimals ? "SENS" : "DPI"}</small></div><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="select-card"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function TestShell({ id, tag, title, description, stat, children }: { id: string; tag: string; title: string; description: string; stat: string; children: React.ReactNode }) {
  return <article className="test-shell" id={id}><div className="test-copy"><small>{tag}</small><h3>{title}</h3><p>{description}</p><strong>{stat}</strong></div><div className="test-stage">{children}</div></article>;
}

function AimArena({ phase, countdown, target, targetSize, hits, limit, onStart, onMove, onMiss, onHit, micro = false }: {
  id: string; active: boolean; phase: AimPhase; countdown: number; target: Point; targetSize: number; hits: number; limit: number;
  onStart: () => void; onMove: (event: React.PointerEvent<HTMLDivElement>) => void; onMiss: () => void; onHit: (event: React.PointerEvent<HTMLButtonElement>) => void; micro?: boolean;
}) {
  return <div className={`aim-arena ${phase} ${micro ? "micro" : ""}`} onPointerMove={onMove} onClick={onMiss}>
    {(phase === "idle" || phase === "done") && <button className="arena-start" onClick={(event) => { event.stopPropagation(); onStart(); }}><b>{phase === "done" ? "重新测试" : "开始测试"}</b><span>必须点击目标才计为命中</span></button>}
    {phase === "countdown" && <div className="arena-count"><b>{countdown}</b><span>把鼠标放在中心</span></div>}
    {phase === "running" && <>
      {micro && <div className="center-guide" />}
      <button aria-label="目标" className="aim-target" style={{ left: `${target.x}%`, top: `${target.y}%`, width: targetSize, height: targetSize }} onPointerDown={onHit}><i /></button>
      <div className="arena-hud"><span>HITS {hits} / {limit}</span><b>MISS COUNTS</b></div>
    </>}
  </div>;
}

function TestMetrics({ result }: { result: AimResult }) {
  const accuracy = result.hits ? Math.round(result.hits / Math.max(1, result.hits + result.misses) * 100) : 0;
  return <div className="metric-line"><span>平均定位 <b>{result.times.length ? `${Math.round(average(result.times))} ms` : "—"}</b></span><span>命中率 <b>{result.hits ? `${accuracy}%` : "—"}</b></span><span>轨迹效率 <b>{result.efficiency.length ? `${Math.round(average(result.efficiency) * 100)}%` : "—"}</b></span></div>;
}

function scoreName(key: string) {
  return ({ reaction: "反应速度", flick: "甩枪定位", micro: "微调稳定", tracking: "移动跟枪", recognition: "目标辨识", consistency: "成绩一致" } as Record<string, string>)[key];
}

function Radar({ scores }: { scores: Scores }) {
  const values = SCORE_KEYS.map((key) => scores[key]);
  const center = 120;
  const radius = 72;
  const points = values.map((value, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 3;
    const r = radius * value / 100;
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
  }).join(" ");
  return <svg className="radar" viewBox="0 0 240 240" role="img" aria-label="六维能力雷达图">
    {[1, .75, .5, .25].map((scale) => <polygon key={scale} points={values.map((_, index) => { const angle = -Math.PI / 2 + index * Math.PI / 3; return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`; }).join(" ")} fill="none" stroke="currentColor" opacity=".16" />)}
    {values.map((_, index) => { const angle = -Math.PI / 2 + index * Math.PI / 3; return <line key={index} x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="currentColor" opacity=".12" />; })}
    <polygon points={points} fill="#ff465544" stroke="#ff4655" strokeWidth="2" />
    {SCORE_KEYS.map((key, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 3;
      const x = center + Math.cos(angle) * 96;
      const y = center + Math.sin(angle) * 96;
      return <text className="radar-label" key={key} x={x} y={y} textAnchor={x < center - 4 ? "end" : x > center + 4 ? "start" : "middle"} dominantBaseline="middle">
        <tspan x={x}>{SCORE_LABELS[key]}</tspan>
        <tspan className="radar-value" x={x} dy="12">{scores[key]}</tspan>
      </text>;
    })}
  </svg>;
}

function CrosshairPreview({ plan, color, pointToCrosshair = false }: { plan: Plan; color: string; pointToCrosshair?: boolean }) {
  // VALORANT's line values are already pixel-like. Keep the preview close to
  // the in-game scale instead of magnifying every unit for presentation.
  const length = Math.max(2, plan.length * 2);
  const thickness = Math.max(1, plan.thickness);
  const gap = Math.max(2, plan.gap + 1);
  const shadow = plan.outline ? "0 0 0 1px #000" : "none";
  return <div className="scene"><div className="scene-grid" /><div className="scene-crate a" /><div className="scene-crate b" /><div className="bot"><i /><b /></div>
    {pointToCrosshair && <div className="crosshair-pointer" aria-hidden="true"><span>就这个</span><i>↙</i></div>}
    <div className={`crosshair ${plan.shape === "猪猪准星" ? "piggy" : ""}`}>
    {plan.shape === "猪猪准星" && <div className="piggy-face" style={{ color }}><i className="pig-ear left-ear" /><i className="pig-ear right-ear" /><i className="pig-eye left-eye" /><i className="pig-eye right-eye" /><i className="pig-snout"><b /><b /></i></div>}
    {plan.shape !== "极简圆点" && plan.shape !== "猪猪准星" && <><i className="top" style={{ width: thickness, height: length, bottom: gap, background: color, boxShadow: shadow }} /><i className="bottom" style={{ width: thickness, height: length, top: gap, background: color, boxShadow: shadow }} /><i className="left" style={{ height: thickness, width: length, right: gap, background: color, boxShadow: shadow }} /><i className="right" style={{ height: thickness, width: length, left: gap, background: color, boxShadow: shadow }} /></>}
    {plan.dot && <i className="dot" style={{ width: thickness + 1, height: thickness + 1, background: color, boxShadow: shadow }} />}
  </div></div>;
}
