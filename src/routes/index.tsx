import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { Button } from "@/components/ui/button";
import { createShapes, type Line, type ShapeKind } from "@/lib/josephs-squares";
import { cn } from "@/lib/utils";
import { hasLegalMove } from "@/lib/move-detection";

const TITLE = "Joseph's Squares — a pen & paper line game";
const DESC =
  "Connect free sides of shapes without ever crossing a line. The player who runs out of moves loses. Better than tic-tac-toe.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const PLAYER_NAMES = ["Player A", "Player B"] as const;

function Index() {
  const [count, setCount] = useState(3);
  const [kind, setKind] = useState<ShapeKind>(4);
  const [seed, setSeed] = useState(0);
  const shapes = useMemo(() => createShapes(count, kind), [count, kind, seed]);

  const [lines, setLines] = useState<Line[]>([]);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [player, setPlayer] = useState<0 | 1>(0);
  const [loser, setLoser] = useState<0 | 1 | null>(null);
  const [message, setMessage] = useState<string>("");

  const reset = useCallback(() => {
    setLines([]);
    setUsed(new Set());
    setPlayer(0);
    setLoser(null);
    setMessage("");
    setSeed((s) => s + 1);
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 2600);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (loser !== null) return;
    if (!hasLegalMove(shapes, lines, used)) {
      setLoser(player);
      setMessage("No legal lines left.");
    }
  }, [shapes, lines, used, player, loser]);

  const handleCommit = useCallback((line: Line, startKey: string, endKey: string) => {
    setLines((ls) => [...ls, line]);
    setUsed((u) => {
      const next = new Set(u);
      next.add(startKey);
      next.add(endKey);
      return next;
    });
    setPlayer((p) => (p === 0 ? 1 : 0));
    setMessage("");
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-hand text-4xl leading-none text-foreground sm:text-5xl">
            Joseph's Squares
          </h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Draw a line from a free side of one shape to a free side of another. Never cross
            anything. Run out of moves and you lose.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-border">
            {([4, 3] as ShapeKind[]).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setKind(k);
                  reset();
                }}
                className={cn(
                  "px-3 py-1.5 text-sm transition-colors",
                  kind === k
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-secondary",
                )}
              >
                {k === 4 ? "Squares" : "Triangles"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setCount(n);
                  reset();
                }}
                className={cn(
                  "size-7 rounded-full text-sm transition-colors",
                  count === n
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        {loser === null ? (
          <p className="font-hand text-2xl">
            <span className={player === 0 ? "text-player-a" : "text-player-b"}>
              {PLAYER_NAMES[player]}
            </span>{" "}
            <span className="text-muted-foreground">draws</span>
          </p>
        ) : (
          <p className="font-hand text-2xl">
            <span className={loser === 0 ? "text-player-b" : "text-player-a"}>
              {PLAYER_NAMES[loser === 0 ? 1 : 0]}
            </span>{" "}
            <span className="text-muted-foreground">wins!</span>
          </p>
        )}
        <div className="flex gap-2">
          {loser === null && (
            <Button variant="outline" size="sm" onClick={() => setLoser(player)}>
              I can't move
            </Button>
          )}
          <Button size="sm" onClick={reset}>
            New game
          </Button>
        </div>
      </div>

      <div className="relative aspect-[10/7] w-full overflow-hidden rounded-2xl border border-border bg-paper shadow-sm">
        <GameCanvas
          shapes={shapes}
          lines={lines}
          used={used}
          currentPlayer={player}
          locked={loser !== null}
          onCommit={handleCommit}
          onMessage={setMessage}
        />
        {message && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="rounded-full bg-foreground/85 px-3 py-1.5 text-xs text-background">
              {message}
            </span>
          </div>
        )}
      </div>

      <section className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <h2 className="font-hand text-xl text-foreground">Rules</h2>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>Players take turns joining a side of one shape to a side of another.</li>
          <li>A side that has been used is closed forever.</li>
          <li>Lines may curve, but may never cross a line or a shape.</li>
          <li>The player who can't draw a legal line loses.</li>
          <li>Don't draw silly confusing squiggles. Be a reasonable human.</li>
        </ol>
      </section>

      <footer className="text-center text-xs text-muted-foreground">
        <a
          href="https://github.com/fiatjaf/josephsquares"
          className="underline hover:text-foreground"
        >
          Source code &amp; more information
        </a>
      </footer>
    </main>
  );
}
