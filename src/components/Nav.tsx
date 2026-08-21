'use client';

// Four places to be, always reachable with a thumb.

export type View = 'board' | 'counters' | 'stats' | 'chat';

const TABS: Array<{ id: View; label: string; icon: string }> = [
  { id: 'board', label: 'Board', icon: '🏁' },
  { id: 'counters', label: 'Counters', icon: '⭕' },
  { id: 'stats', label: 'Stats', icon: '📈' },
  { id: 'chat', label: 'Chat', icon: '💬' },
];

export function Nav({
  view,
  onGo,
  unread,
}: {
  view: View;
  onGo: (v: View) => void;
  /** Messages waiting, shown as a dot on the chat tab. */
  unread: number;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t"
      style={{
        borderColor: 'var(--dust)',
        background: 'var(--board)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map(tab => {
          const on = view === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onGo(tab.id)}
              aria-current={on ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5"
              style={{ color: on ? 'var(--chalk)' : 'var(--chalk-dim)' }}
            >
              <span className="text-lg leading-none" style={{ opacity: on ? 1 : 0.55 }}>
                {tab.icon}
              </span>
              <span className="font-score text-[10px] font-bold uppercase tracking-wide">{tab.label}</span>
              {tab.id === 'chat' && unread > 0 && (
                <span
                  className="font-score absolute right-1/2 top-1 -mr-3 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black"
                  style={{ background: 'var(--score)', color: 'var(--board)' }}
                >
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
