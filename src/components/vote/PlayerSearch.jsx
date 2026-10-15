import { useState } from "react";
import { Search } from "lucide-react";
import PixelBox from "../ui/PixelBox";
import PixelButton from "../ui/PixelButton";
import { searchPlayer, avatarUrl } from "../../data/votes";

export default function PlayerSearch() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done
  const [result, setResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setStatus("loading");
    const found = await searchPlayer(query);
    setResult(found);
    setStatus("done");
  };

  return (
    <div className="mt-14 flex flex-col items-center">
      <h2 className="title text-[25px]! gold-gradient-text">Find a Player</h2>

      <form
        onSubmit={handleSearch}
        className="mt-4 flex w-full max-w-4xl gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter ingame name..."
          className="h-12 flex-1 rounded-sm border border-white/10 bg-black/40 px-4 text-[12px] text-(--color-text) outline-none focus:border-(--color-primary) "
        />
        <PixelButton
          className="px-4! py-4.5!"
          tone="primary"
          icon={Search}
          type="submit"
        >
          Search
        </PixelButton>
      </form>

      {status === "loading" && (
        <p className="mt-3 text-[11px] text-(--color-text-dim)">Searching...</p>
      )}

      {status === "done" && (
        <div className="mt-4 w-full max-w-md">
          {result ? (
            <PixelBox tone="primary" contentClassName="flex items-center gap-4">
              <img
                src={avatarUrl(result.username, 48)}
                alt={result.username}
                className="h-15 w-15 rounded-sm [image-rendering:pixelated]"
              />
              <div>
                <p className="text-[13px] green-gradient-text">
                  {result.username}
                </p>
                <p className="text-[11px] gradient-text">
                  Rank{" "}
                  <span className="gold-gradient-text">#{result.rank}</span> ·
                  votes (all time) 
                  <span className="gold-gradient-text">
                    {" "}{result.votes.toLocaleString()}
                  </span>
                </p>
              </div>
            </PixelBox>
          ) : (
            <p className="text-center text-[11.5px] text-(--color-text-muted)">
              No voter found with that username.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
