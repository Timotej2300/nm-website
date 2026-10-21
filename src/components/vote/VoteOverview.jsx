import { useEffect, useState } from "react";
import PixelBox from "../ui/PixelBox";
import { fetchVoteStats } from "../../data/votes";
import totalVoters from "../../assets/votes/stats/total-voters.png";
import totalVotes from "../../assets/votes/stats/total-votes.png";
import todayVotes from "../../assets/votes/stats/today-votes.png";
import weekVotes from "../../assets/votes/stats/week-votes.png";
import monthVotes from "../../assets/votes/stats/month-votes.png";


function formatCountdown(targetIso) {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return "00h 00m 00s";
  const totalSec = Math.floor(diff / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h}h ${m}m ${s}s`;
}

function StatCard({ icon, value, label }) {
  return (
    <PixelBox tone="primary" contentClassName="flex flex-col items-center gap-2 text-center">
      <img src={icon} alt="" className="h-10 w-10 object-contain [image-rendering:pixelated]" />
      <span className="text-[18px] gold-gradient-text">{value.toLocaleString()}</span>
      <span className="text-[9.5px] tracking-[0.14em] gradient-text">{label}</span>
    </PixelBox>
  );
}

export default function VoteOverview() {
  const [stats, setStats] = useState(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    let isMounted = true;
    fetchVoteStats().then((data) => {
      if (isMounted) setStats(data);
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!stats?.nextResetAt) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [stats?.nextResetAt]);

  const countdown = stats?.nextResetAt ? formatCountdown(stats.nextResetAt) : "--h --m --s";

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <h1 className="title gold-gradient-text">Vote for Our Server</h1>
        <p className="p">
          Support our server by voting daily and earn awesome in-game rewards!
        </p>

        <PixelBox tone="primary" className="mt-5" contentClassName="flex items-center gap-2 px-5!">
          <span className="text-[14px] gradient-text">Next Vote Reset:</span>
          <span className="text-[14px] gold-gradient-text">{countdown}</span>
        </PixelBox>
      </div>

      {stats?.weeklyGoal && <PixelBox tone="success" className="mt-8" contentClassName="flex flex-col items-center gap-3">
        <h2 className="text-[15px] green-gradient-text">Weekly Server Goal</h2>

        {stats && (
          <>
            <div className="flex w-full max-w-6xl justify-between text-[10.5px] text-(--color-text-dim)">
              <span className="gradient-text text-[12px] sm:text-[12px] md:text-[13px] lg:text-[14px]">{stats.weeklyGoal.current.toLocaleString()} votes</span>
              <span className="gold-gradient-text text-[12px] sm:text-[12px] md:text-[13px] lg:text-[14px]">{stats.weeklyGoal.target.toLocaleString()} votes</span>
            </div>
            <div className="h-2.5 w-full max-w-6xl overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-(--color-success)"
                style={{
                  width: `${Math.min(
                    100,
                    (stats.weeklyGoal.current / stats.weeklyGoal.target) * 100
                  )}%`,
                }}
              />
            </div>
          </>
        )}

        <p className="p">
          Help us reach our weekly goal to unlock a special event for everyone!
        </p>
      </PixelBox>}

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard icon={totalVotes} value={stats.totalVotes} label="TOTAL VOTES" />
          <StatCard icon={totalVoters} value={stats.totalVoters} label="TOTAL VOTERS" />
          <StatCard icon={todayVotes} value={stats.todayVotes} label="TODAY'S VOTES" />
          <StatCard icon={weekVotes} value={stats.weekVotes} label="THIS WEEK'S VOTES" />
          <StatCard icon={monthVotes} value={stats.monthVotes} label="THIS MONTH'S VOTES" />
        </div>
      )}
    </div>
  );
}