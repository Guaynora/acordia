/** Round profile picture, or the name's initial when there is none. */
export function Avatar({ name, image, size = "sm" }: { name: string; image: string | null; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "size-20 text-3xl" : "size-8 text-sm";
  if (image) {
    // Google avatars are small and already sized; next/image would need a remote pattern.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" referrerPolicy="no-referrer" className={`${box} shrink-0 rounded-full`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
