import Link from "next/link";

// Rendered inside the localized layout; kept bilingual because not-found
// files receive no params.
export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">No encontramos esa página · Page not found</h1>
      <Link href="/" className="text-accent underline-offset-2 hover:underline">
        Acordia
      </Link>
    </div>
  );
}
