import { Link } from "react-router-dom";
import { Calendar, ArrowRight } from "lucide-react";
import PixelBox from "../components/ui/PixelBox";
import PixelButton from "../components/ui/PixelButton";
import { newsPosts } from "../data/news";
import { useSeo } from "../hooks/useSeo";

export default function News() {
  useSeo({
    title: "News",
    description:
      "Season recaps, community events, and every announcement from the BDZONE Minecraft server.",
    path: "/news",
  });
  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 s">
      <h1 className="title gold-gradient-text">Latest News</h1>
      <p className="p">
        Events, season recaps, and everything happening around the server.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {newsPosts.map(
          ({ slug, image, category, tone, date, title, excerpt }) => (
            <PixelBox
              key={slug}
              tone="info"
              padding="none"
              className="overflow-hidden transition-transform hover:-translate-y-1"
            >
              <div className=" w-full overflow-hidden bg-(--color-bg-soft)">
                <img
                  src={image}
                  alt={title}
                  className="h-full w-full object-cover [image-rendering:pixelated]"
                />
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
                      <ArrowRight size={14} strokeWidth={2} color="#fff" />
                    </span>
                  </PixelButton>
                </Link>
              </div>
            </PixelBox>
          ),
        )}
      </div>
    </section>
  );
}
