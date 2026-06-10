import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const DISCOURSE_BASE_URL = (Deno.env.get("DISCOURSE_BASE_URL") || "").replace(
  /\/+$/,
  "",
);
const DISCOURSE_ADMIN_API_KEY = Deno.env.get("DISCOURSE_ADMIN_API_KEY") || "";
const DISCOURSE_ADMIN_API_USERNAME =
  Deno.env.get("DISCOURSE_ADMIN_API_USERNAME") || "system";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const IMAGE_SRC_RE = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
const DISCOURSE_NEW_TOPIC_ACTION = "4";
const DISCOURSE_REPLY_ACTION = "5";
const MAX_ACTION_PAGES = 8;
const ACTION_PAGE_SIZE = 30;
const MAX_PHOTO_POSTS_TO_INSPECT = 60;

type RequestBody = {
  userId?: string;
};

type RegistrationRow = {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  status?: string | null;
};

type UserAction = {
  excerpt?: string | null;
  action_type?: number | null;
  created_at?: string | null;
  slug?: string | null;
  topic_id?: number | null;
  target_username?: string | null;
  post_number?: number | null;
  post_id?: number | string | null;
  username?: string | null;
  title?: string | null;
  deleted?: boolean | null;
  hidden?: boolean | string | null;
};

type DiscoursePost = {
  id?: number | string | null;
  cooked?: string | null;
  created_at?: string | null;
  topic_id?: number | null;
  topic_slug?: string | null;
  post_number?: number | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function assertConfig() {
  const missing: string[] = [];

  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("SUPABASE_ANON_KEY");
  if (!DISCOURSE_BASE_URL) missing.push("DISCOURSE_BASE_URL");
  if (!DISCOURSE_ADMIN_API_KEY) missing.push("DISCOURSE_ADMIN_API_KEY");
  if (!DISCOURSE_ADMIN_API_USERNAME)
    missing.push("DISCOURSE_ADMIN_API_USERNAME");

  if (missing.length > 0)
    throw new Error(`Missing configuration: ${missing.join(", ")}`);
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function getDiscourseHeaders() {
  return {
    "Api-Key": DISCOURSE_ADMIN_API_KEY,
    "Api-Username": DISCOURSE_ADMIN_API_USERNAME,
    Accept: "application/json",
  };
}

async function discourseFetch(path: string) {
  const response = await fetch(`${DISCOURSE_BASE_URL}${path}`, {
    headers: getDiscourseHeaders(),
  });

  const text = await response.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body && "errors" in body
        ? JSON.stringify((body as { errors: unknown }).errors)
        : text || response.statusText;

    throw new Error(`Discourse API failed (${response.status}): ${message}`);
  }

  return body;
}

function toInt(value: unknown) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) ? numberValue : null;
}

function stripHtml(value?: string | null) {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteDiscourseUrl(pathOrUrl: string) {
  try {
    return new URL(pathOrUrl, DISCOURSE_BASE_URL).toString();
  } catch {
    return `${DISCOURSE_BASE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  }
}

function postUrl(
  action: Pick<UserAction, "slug" | "topic_id" | "post_number">,
) {
  if (!action.topic_id) return DISCOURSE_BASE_URL;

  const slug = action.slug || "topic";
  const postNumber = action.post_number || 1;
  return `${DISCOURSE_BASE_URL}/t/${slug}/${action.topic_id}/${postNumber}`;
}

function mapAction(action: UserAction) {
  return {
    id: String(
      action.post_id ||
        `${action.topic_id || "topic"}-${action.post_number || action.created_at || "comment"}`,
    ),
    content: stripHtml(action.excerpt),
    created_at: action.created_at ?? null,
    topic_id: action.topic_id ?? null,
    post_id: action.post_id ?? null,
    post_number: action.post_number ?? null,
    topic_title: action.title ?? "Untitled topic",
    topic_slug: action.slug ?? null,
    target_username: action.target_username ?? null,
    url: postUrl(action),
  };
}

async function fetchUserActions(
  username: string,
  filter: string,
  pages = MAX_ACTION_PAGES,
) {
  const allActions: UserAction[] = [];

  for (let page = 0; page < pages; page += 1) {
    const offset = page * ACTION_PAGE_SIZE;
    const params = new URLSearchParams({
      username,
      filter,
      offset: String(offset),
    });
    const body = (await discourseFetch(
      `/user_actions.json?${params.toString()}`,
    )) as { user_actions?: UserAction[] };
    const actions = Array.isArray(body.user_actions) ? body.user_actions : [];
    const visibleActions = actions.filter(
      (action) => !action.deleted && !action.hidden,
    );

    allActions.push(...visibleActions);

    if (actions.length < ACTION_PAGE_SIZE) break;
  }

  return allActions;
}

function extractImageUrls(cooked?: string | null) {
  if (!cooked) return [];

  const urls: string[] = [];
  let match: RegExpExecArray | null;

  IMAGE_SRC_RE.lastIndex = 0;
  while ((match = IMAGE_SRC_RE.exec(cooked))) {
    const url = match[1];
    if (!url || url.startsWith("data:")) continue;
    urls.push(absoluteDiscourseUrl(url));
  }

  return urls;
}

async function getPost(postId: number) {
  return (await discourseFetch(`/posts/${postId}.json`)) as DiscoursePost;
}

async function collectPhotos(actions: UserAction[]) {
  const photos = new Map<
    string,
    {
      id: string;
      url: string;
      post_url: string;
      topic_title: string;
      created_at: string | null;
    }
  >();

  const inspectable = actions
    .filter((action) => toInt(action.post_id))
    .slice(0, MAX_PHOTO_POSTS_TO_INSPECT);

  for (const action of inspectable) {
    const postId = toInt(action.post_id);
    if (!postId) continue;

    try {
      const post = await getPost(postId);
      const imageUrls = extractImageUrls(post.cooked);

      for (const imageUrl of imageUrls) {
        if (photos.has(imageUrl)) continue;
        photos.set(imageUrl, {
          id: `${postId}-${photos.size}`,
          url: imageUrl,
          post_url: postUrl({
            slug: action.slug || post.topic_slug || undefined,
            topic_id: action.topic_id || post.topic_id || undefined,
            post_number: action.post_number || post.post_number || undefined,
          }),
          topic_title: action.title || "Discourse post",
          created_at: post.created_at || action.created_at || null,
        });
      }
    } catch (error) {
      console.warn(
        `Unable to inspect Discourse post ${postId} for images`,
        error,
      );
    }
  }

  return Array.from(photos.values());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    assertConfig();

    const token = getBearerToken(req);
    if (!token) return json(401, { error: "Missing authorization token" });

    const scopedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } =
      await scopedSupabase.auth.getUser(token);
    if (authError || !authData.user)
      return json(401, { error: "Invalid authorization token" });

    let body: RequestBody = {};
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const targetUserId = body.userId || authData.user.id;

    const { data: actorRegistration, error: actorError } = await supabaseAdmin
      .from("registrations")
      .select("id, username, status")
      .eq("id", authData.user.id)
      .maybeSingle<RegistrationRow>();

    if (actorError || !actorRegistration)
      return json(403, { error: "Registration not found" });

    const actorIsAdmin = Boolean(authData.user.email?.includes("admin"));
    if (targetUserId !== authData.user.id && !actorIsAdmin) {
      return json(403, {
        error: "You can only view your own Discourse activity",
      });
    }

    const { data: targetRegistration, error: targetError } = await supabaseAdmin
      .from("registrations")
      .select("id, username, firstName, lastName, status")
      .eq("id", targetUserId)
      .maybeSingle<RegistrationRow>();

    if (targetError || !targetRegistration)
      return json(404, { error: "Profile not found" });

    const username = (targetRegistration.username || "").trim();
    if (!username)
      return json(200, {
        ok: true,
        discourseBaseUrl: DISCOURSE_BASE_URL,
        username: null,
        photos: [],
        recentComments: [],
        stats: {
          totalPhotos: 0,
          totalComments: 0,
          totalTopics: 0,
          lastActivityAt: null,
        },
      });

    const [topicActions, replyActions] = await Promise.all([
      fetchUserActions(username, DISCOURSE_NEW_TOPIC_ACTION),
      fetchUserActions(username, DISCOURSE_REPLY_ACTION),
    ]);

    const allPostActions = [...topicActions, ...replyActions].sort((a, b) => {
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });

    const photos = await collectPhotos(allPostActions);
    const recentComments = replyActions.slice(0, 2).map(mapAction);
    const lastActivityAt = allPostActions[0]?.created_at ?? null;

    return json(200, {
      ok: true,
      discourseBaseUrl: DISCOURSE_BASE_URL,
      username,
      photos,
      recentComments,
      stats: {
        totalPhotos: photos.length,
        totalComments: replyActions.length,
        totalTopics: topicActions.length,
        lastActivityAt,
      },
    });
  } catch (error) {
    console.error("profile-discourse-activity failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return json(500, { error: message });
  }
});
