import { revalidateTag } from 'next/cache';

// Spike-only: a real app protects this with a webhook secret.
export async function POST(request: Request) {
  const tag = new URL(request.url).searchParams.get('tag') ?? 'news';
  revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: tag });
}
