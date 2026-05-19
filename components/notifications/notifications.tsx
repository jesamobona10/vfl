"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const body = await res.json();
      if (res.ok) setItems(body.notifications || []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    const id = setInterval(fetchItems, 10000);
    return () => clearInterval(id);
  }, []);

  const markRead = async (ids: number[]) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) fetchItems();
    } catch {}
  };

  const unreadCount = items.filter((i) => !i.is_read).length;

  return (
    <div className="relative">
      <button
        className="btn-icon relative"
        onClick={() => {
          setOpen(!open);
          if (!open) setTimeout(fetchItems, 0);
        }}
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-danger text-white text-xs rounded-full px-1">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface border border-line rounded shadow-lg z-50">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <strong>Notifications</strong>
              <button
                className="text-sm text-muted"
                onClick={() => markRead(items.filter(i=>!i.is_read).map(i=>i.id))}
              >
                Mark all read
              </button>
            </div>
            {loading && <p>Loading...</p>}
            {!loading && items.length === 0 && <p className="text-sm text-muted">No notifications</p>}
            <ul className="space-y-2 max-h-64 overflow-auto">
              {items.map((n) => (
                <li key={n.id} className={`p-2 rounded ${n.is_read ? '' : 'bg-accent/10'}`}>
                  <div className="text-sm">
                    {n.type === 'player_transfer_in' && (
                      <span>Player <strong>{n.payload?.player_name}</strong> joined your team.</span>
                    )}
                    {n.type === 'player_transfer_out' && (
                      <span>Player <strong>{n.payload?.player_name}</strong> left your team.</span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-1 flex items-center justify-between">
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                    {!n.is_read && (
                      <button
                        className="text-xs text-brand"
                        onClick={() => markRead([n.id])}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
