function App() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary text-text-primary font-sans">
      <h1 className="text-4xl font-bold mb-4">Geas Dashboard</h1>
      <p className="text-text-secondary text-lg">
        Mission control for multi-agent governance.
      </p>
      <div className="mt-8 flex gap-3">
        <span className="inline-block w-3 h-3 rounded-full bg-status-blue" />
        <span className="inline-block w-3 h-3 rounded-full bg-status-green" />
        <span className="inline-block w-3 h-3 rounded-full bg-status-amber" />
        <span className="inline-block w-3 h-3 rounded-full bg-status-red" />
      </div>
    </div>
  );
}

export default App;
