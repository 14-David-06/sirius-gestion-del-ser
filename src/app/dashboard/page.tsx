"use client";

export default function DashboardPage() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center max-w-xl">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-white/[0.08] ring-1 ring-white/[0.12] backdrop-blur-sm flex items-center justify-center text-2xl shadow-lg shadow-black/20">
          🌿
        </div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
          Bienvenido a Sirius
        </h1>
        <p className="mt-3 text-white/50 text-sm font-medium">
          Selecciona una sección en el menú superior para empezar.
        </p>
      </div>
    </div>
  );
}
