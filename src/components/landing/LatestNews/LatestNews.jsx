import { Link } from "react-router-dom";
import { ArrowRight, Calendar } from "lucide-react";
import PixelBox from "../../ui/PixelBox";
import PixelButton from "../../ui/PixelButton";
import { useApi } from "../../../hooks/useApi";

export default function LatestNews() {
  // Homepage teaser only shows the 3 most recent posts.
  const { data } = useApi("/news?limit=3");
  const POSTS = (data?.posts || []).slice(0, 3);
  if (data && POSTS.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-25 sm:px-6">
      <div>
        <h2 className="title gold-gradient-text">Latest News &amp; Insights</h2>
        <p className="p">
          Explore our latest insights, community stories, and in-depth articles.
        </p>
      </div>
      <div className="flex mt-10 items-start justify-end sm:flex-row sm:items-end">
        <Link to="/news" className="shrink-0">
          <PixelButton
            icon={ArrowRight}
            iconClassName="text-[#35c2fc]"
            className="flex-row-reverse px-4!"
            tone="info"
            size="lg"
          >
            <span className="info-gradient-text text-[14px]!">
              Read All Articles
            </span>
          </PixelButton>
        </Link>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {POSTS.map(({ slug, image, category, tone, date, title, excerpt }) => (
          <PixelBox
            key={slug}
            tone="info"
            padding="none"
            className="overflow-hidden transition-transform hover:-translate-y-1"
          >
            <div className=" w-full overflow-hidden bg-(--color-bg-soft)">
              {image && <img
                src={image}
                alt={title}
                className="h-full w-full object-cover [image-rendering:pixelated]"
              />}
            </div>

            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <span
                  className="rounded-sm px-2 py-1 text-[9px] tracking-widest grident-text"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${tone} 18%, transparent)`,
                    color: tone,
                  }}
                >
                  {category.toUpperCase()}
                </span>
                <span className="flex items-center gap-1 text-[10.5px] gradient-text">
                  <Calendar
                    size={12}
                    strokeWidth={2}
                    className="text-(--color-text)"
                  />
                  {date}
                </span>
              </div>

              <h3 className="text-[13.5px] gold-gradient-text truncate">
                {title}
              </h3>

              <p className="p text-start! text-[10px]!">{excerpt}</p>

              <Link to={`/news/${slug}`} className="mt-auto">
                <PixelButton tone="info" className="w-full py-5! gap-0!">
                 <span className="flex items-center justify-center gap-2 gradient-text">
                   Read More 
                  <ArrowRight size={14} strokeWidth={2} color="#fff"/>
                 </span>
                </PixelButton>
              </Link>
            </div>
          </PixelBox>
        ))}
      </div>
    </section>
  );
}