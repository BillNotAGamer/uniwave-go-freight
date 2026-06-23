export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Internal App Foundation
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Uniwave Go Freight
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Phase 1 foundation is in place. Next.js App Router, TypeScript,
            Tailwind CSS, and ESLint are configured without any business
            workflows, authentication, database schema, or role logic yet.
          </p>
        </div>

        <section className="mt-8 rounded-md border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-semibold text-slate-800">
            Current scope
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Framework and build foundation only</li>
            <li>Documentation preserved at the repository root</li>
            <li>Boundary folders prepared for later phases</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
