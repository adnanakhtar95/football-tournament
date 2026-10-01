export default function AdminPage() {
  return (
    <main className="page">
      <h1>Admin Dashboard</h1>

      <p>
        Manage football events, teams, rounds, matches,
        and live match actions.
      </p>

      <div className="admin-grid">
        <a href="/admin/events">Events</a>
        <a href="/admin/teams">Teams</a>
        <a href="/admin/rounds">Rounds</a>
        <a href="/admin/matches">Matches</a>
      </div>
    </main>
  );
}