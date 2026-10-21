import { Link, useParams } from "react-router-dom";
import { Calendar, ArrowLeft, User } from "lucide-react";
import PixelBox from "../components/ui/PixelBox";
import PixelButton from "../components/ui/PixelButton";
import { useApi } from "../hooks/useApi";
import { ErrorBox, Loading } from "../components/ui/Form";
import { useSeo } from "../hooks/useSeo";

function ContentBlock({ block }) {
  if (block.type === "h2") {
    return (
      <h2
        className="mt-6 text-[16px] gold-gradient-text first:mt-0"
      >
        {block.text}
      </h2>
    );
  }

  if (block.type === "list") {
    return (
      <ul className="mt-3 flex flex-col gap-2">
        {block.items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-[13px] leading-relaxed text-(--color-text-muted)"
          >
            <span className="mt-1.75 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-primary)" />
            {item}
          </li>
        ))}
      </ul>
    );
  }

  // default: paragraph
  return (
    <p className="mt-3 text-[13px] leading-relaxed text-(--color-text-muted)">
      {block.text}
    </p>
  );
}

export default function NewsDetails() {
  const { slug } = useParams();
  const { data, error, loading, reload } = useApi(`/news/${encodeURIComponent(slug)}`);
  const post = data?.post;
  const list = useApi("/news?limit=6");

  useSeo(
    post
      ? {
          title: post.seoTitle || post.title,
          description: post.seoDescription || post.excerpt,
          path: `/news/${post.slug}`,
          image: post.image,
        }
      : { title: "Post Not Found", path: `/news/${slug}`, noindex: true },
  );

  if (loading) return <Loading />;
  if (error && !/nenájdená|not.?found/i.test(error) && !post) return <ErrorBox message={error} onRetry={reload} />;
  if (!post) {
    return (
      <section className="mx-auto max-w-3xl px-4 flex h-screen flex-col items-center justify-center text-center sm:px-6">
        <h1
          className="text-[24px] text-(--color-text) gold-gradient-text"
        >
          Post Not Found
        </h1>
        <p className="mt-3 text-[13px] text-(--color-text-muted)">
          That news post doesn't exist or may have been removed.
        </p>
        <Link to="/news" className="mt-8 inline-block">
          <PixelButton icon={ArrowLeft} className="px-6! py-5!">
            Back to News
          </PixelButton>
        </Link>
      </section>
    );
  }

  const related = (list.data?.posts || []).filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 ">
      <Link to={'/news'}>
        <PixelButton className="px-4! py-5!">
          <span className="flex items-center justify-center gap-2 gold-gradient-text">
            <ArrowLeft size={15} strokeWidth={2} color="#ffc02e" />
            BACK TO NEWS
          </span>
        </PixelButton>
      </Link>

      {post.image && (
      <div className="w-full mt-6 rounded-lg overflow-hidden bg-(--color-bg-soft)">
        <img
          src={post.image}
          alt={post.title}
          className="h-full w-full object-cover [image-rendering:pixelated]"
        />
      </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <span
          className="rounded-sm px-2 py-1 text-[9px] tracking-widest"
          style={{
            backgroundColor: `color-mix(in srgb, ${post.tone} 18%, transparent)`,
            color: post.tone,
          }}
        >
          {post.category.toUpperCase()}
        </span>
        <span className="flex items-center gap-1 text-[13px] gradient-text">
          <Calendar size={14} strokeWidth={2} color="#e9e9e9"/>
          {post.date}
        </span>
        <span className="flex items-center gap-1 text-[13px] gradient-text">
          <User size={14} strokeWidth={2} color="#e9e9e9"/>
          {post.author}
        </span>
      </div>

      <h1
        className="mt-4 leading-tight gold-gradient-text  sm:text-2xl md:text-2xl lg:text-3xl"
      >
        {post.title}
      </h1>

      <div className="mt-8 border-t border-white/10 pt-8">
        {post.content.map((block, i) => (
          <ContentBlock key={i} block={block} />
        ))}
      </div>

      {related.length > 0 && (
        <div className="mt-14">
          <h3 className="gold-gradient-text title">
            MORE NEWS
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link key={r.slug} to={`/news/${r.slug}`}>
                <PixelBox
                  tone="info"
                  padding="none"
                  className="overflow-hidden transition-transform hover:-translate-y-1"
                >
                  <div className=" w-full overflow-hidden bg-(--color-bg-soft)">
                    <img
                      src={r.image}
                      alt={r.title}
                      className="h-full w-full object-cover [image-rendering:pixelated]"
                    />
                  </div>
                  <div className="p-3">
                    <h4 className="text-[11.5px] gold-gradient-text truncate">
                      {r.title}
                    </h4>
                    <span className="mt-1 block text-[11px] gradient-text">
                      {r.date}
                    </span>
                  </div>
                </PixelBox>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
