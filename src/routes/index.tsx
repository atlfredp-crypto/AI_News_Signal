import { createFileRoute } from "@tanstack/react-router";
import { Digest } from "@/components/news/digest";
import { fetchNews } from "@/lib/news/api";

export const Route = createFileRoute("/")({
  loader: () => fetchNews({ data: {} }),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return (
    <main className="min-w-0 overflow-x-hidden">
      <Digest initial={initial} />
    </main>
  );
}
