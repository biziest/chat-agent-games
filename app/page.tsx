import { Chat } from "@/app/components/chat";

export default function Home() {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Chat: left third of the viewport. */}
      <aside className="flex h-full w-1/3 min-w-0 flex-col border-r border-border bg-surface">
        <Chat />
      </aside>

      {/* Main area: yours to fill in. */}
      <main className="flex h-full min-w-0 flex-1 flex-col bg-background">
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl border border-border bg-surface">
              <span className="size-2.5 rounded-full bg-accent/70" />
            </div>
            <h2 className="text-base font-medium tracking-tight">Main area</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Two thirds of the viewport, ready for whatever this becomes.
              Render it from{" "}
              <code className="font-mono text-xs">app/page.tsx</code>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
