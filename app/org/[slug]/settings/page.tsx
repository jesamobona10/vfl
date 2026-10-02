export default function OrgSettingsPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Organization Settings</h2>
        <p className="text-sm text-muted">Public match updates include player names for recorded events.</p>
      </div>
      <div className="card p-4 space-y-3">
        <p className="text-sm font-medium">Public match updates</p>
        <p className="text-xs text-ink-3">
          Player names appear beside goals, assists, cards, and other recorded match events. Player photos are not used.
        </p>
      </div>
    </div>
  );
}
