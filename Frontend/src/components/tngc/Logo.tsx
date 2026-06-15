export function Logo({
  size = 32,
  withGradient = true,
}: {
  size?: number;
  withGradient?: boolean;
}) {
  return (
    <div
      className="rounded-2xl grid place-items-center shadow-lg overflow-hidden bg-white"
      style={{
        width: size,
        height: size,
        boxShadow: "0 6px 20px rgba(27,79,138,0.15)",
      }}
    >
      <img
        src="/tn_logo.png"
        alt="KGC Logo"
        style={{ width: size * 0.8, height: size * 0.8, objectFit: "contain" }}
      />
    </div>
  );
}
