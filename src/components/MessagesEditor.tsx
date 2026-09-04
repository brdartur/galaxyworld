import { useEffect } from "react";

export const DEFAULT_EARTH_MSG = "Дамир и Алия, поднимайтесь по канату! Я вас вытяну)";
export const DEFAULT_MARS_MSGS = [
  "Привет, Дамир и Алия!",
  "Салют с Марса, Дамир и Алия!",
  "Дамир и Алия, вы лучшие!",
  "Марсианин шлёт привет Дамиру и Алие!",
];

interface Props {
  earthMsg: string;
  marsMsgs: string[];
  onEarthMsg: (v: string) => void;
  onMarsMsgs: (v: string[]) => void;
  onClose: () => void;
  onReset: () => void;
}

/** Редактор сообщений корабля (Земля) и марсианина (Марс) */
export default function MessagesEditor({ earthMsg, marsMsgs, onEarthMsg, onMarsMsgs, onClose, onReset }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="backdrop-in fixed inset-0 z-[60] grid place-items-center bg-space-950/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel-in w-full max-w-[520px] overflow-hidden rounded-xl border border-line bg-space-900 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {/* шапка */}
        <div className="flex items-center justify-between border-b border-line bg-space-850 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 26 26" aria-hidden>
              <ellipse cx="13" cy="15" rx="11" ry="4.4" fill="#8f9fc0" />
              <path d="M6.5 13.5a6.5 4.5 0 0 1 13 0Z" fill="#c8f4ff" />
              <circle cx="8" cy="16.6" r="1.2" fill="#ffd166" />
              <circle cx="13" cy="17.4" r="1.2" fill="#8ff5e9" />
              <circle cx="18" cy="16.6" r="1.2" fill="#ff9ad5" />
            </svg>
            <div>
              <h2 className="font-display text-[14px] leading-none font-bold tracking-[0.06em] text-ink">
                СООБЩЕНИЯ КОРАБЛЯ
              </h2>
              <p className="mt-1 font-mono text-[8.5px] tracking-[0.2em] text-faint">РЕДАКТИРУЙТЕ ПРИВЕТСТВИЯ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="grid h-8 w-8 place-items-center rounded-md border border-line text-dim transition-all hover:rotate-90 hover:border-amber/60 hover:text-amber"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        <div className="scroll-y max-h-[62vh] space-y-5 overflow-y-auto px-5 py-5">
          {/* Земля */}
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#45a5f2] shadow-[0_0_8px_#45a5f2]" />
              <label htmlFor="msg-earth" className="font-mono text-[10px] font-semibold tracking-[0.2em] text-amber">
                С КОРАБЛЯ · ПРИ КОНТАКТЕ С ЗЕМЛЁЙ
              </label>
            </div>
            <input
              id="msg-earth"
              value={earthMsg}
              onChange={(e) => onEarthMsg(e.target.value)}
              maxLength={140}
              placeholder="Сообщение с корабля…"
              className="mt-2 w-full rounded-md border border-line bg-space-850 px-3 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:border-amber/60"
            />
            <p className="mt-1.5 font-mono text-[9px] tracking-[0.08em] text-faint">
              Показывается, когда канат спущен и корабль ждёт у Земли.
            </p>
          </div>

          {/* Марс */}
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e0714a] shadow-[0_0_8px_#e0714a]" />
              <label htmlFor="msg-mars" className="font-mono text-[10px] font-semibold tracking-[0.2em] text-teal">
                МАРСИАНИН · ПРИВЕТЫ С МАРСА
              </label>
            </div>
            <textarea
              id="msg-mars"
              value={marsMsgs.join("\n")}
              onChange={(e) =>
                onMarsMsgs(
                  e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              rows={5}
              placeholder={"Привет, Дамир и Алия!\nКаждое сообщение — с новой строки…"}
              className="scroll-y mt-2 w-full resize-y rounded-md border border-line bg-space-850 px-3 py-2.5 text-[14px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus:border-teal/60"
            />
            <p className="mt-1.5 font-mono text-[9px] tracking-[0.08em] text-faint">
              По одному приветствию на строку — марсианин чередует их по кругу.
            </p>
          </div>
        </div>

        {/* низ */}
        <div className="flex items-center justify-between border-t border-line bg-space-850 px-5 py-3.5">
          <button
            onClick={onReset}
            className="rounded-md border border-line px-3.5 py-2 font-mono text-[10.5px] tracking-[0.14em] text-dim transition-all hover:border-amber/50 hover:text-amber active:scale-95"
          >
            ПО УМОЛЧАНИЮ
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-amber px-5 py-2 font-mono text-[10.5px] font-semibold tracking-[0.14em] text-space-950 transition-all hover:bg-[#ffc670] hover:shadow-[0_0_18px_rgba(255,181,71,0.4)] active:scale-95"
          >
            ГОТОВО
          </button>
        </div>
      </div>
    </div>
  );
}
