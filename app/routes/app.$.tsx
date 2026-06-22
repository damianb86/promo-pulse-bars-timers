import { NotFoundPage } from "../components/NotFoundPage";

export const loader = () => {
  throw new Response("Page not found.", { status: 404 });
};

export default function AppNotFoundRoute() {
  return <NotFoundPage />;
}

export function ErrorBoundary() {
  return <NotFoundPage />;
}
