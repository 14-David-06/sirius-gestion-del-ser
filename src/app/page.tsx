import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <Image
        src="/21032025-DSCF8676.jpg"
        alt=""
        fill
        className="object-cover object-center"
        priority
        quality={90}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl">
        <div className="bg-white rounded-2xl px-8 py-5 mb-10 shadow-2xl">
          <Image
            src="/Logo-Sirius.png"
            alt="Sirius"
            width={240}
            height={83}
            priority
          />
        </div>

        <h1 className="text-white text-2xl md:text-3xl font-light mb-3 tracking-wide">
          Gestión del Ser
        </h1>
        <p className="text-white/70 text-base md:text-lg mb-12 leading-relaxed max-w-md">
          Plataforma integral de talento humano, contratos y cumplimiento laboral
        </p>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-14 py-4 bg-[#1a51a8] hover:bg-[#1a4494] text-white text-lg font-semibold rounded-full transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.03] cursor-pointer select-none"
        >
          Acceder
        </Link>
      </div>
    </main>
  );
}
