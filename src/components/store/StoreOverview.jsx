import { useEffect, useState } from "react";
import {  Users, Clock } from "lucide-react";
import PixelBox from "../ui/PixelBox";
import { fetchStoreStats, fetchMonthlyGoal } from "../../data/store";
import totalRaised from "../../assets/votes/stats/total-voters.png";
import totalVotes from "../../assets/store/total-raised.png";

function daysLeft(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function StatCard({ icon, value, label }) {
  return (
    <PixelBox
      tone="primary"
      contentClassName="flex flex-col items-center gap-2 text-center"
    >
      <img
        src={icon}
        alt=""
        className="h-10 w-10 object-contain [image-rendering:pixelated]"
      />
      <span className="text-[18px] gold-gradient-text">{value}</span>
      <span className="text-[9.5px] tracking-[0.14em] gradient-text">
        {label}
      </span>
    </PixelBox>
  );
}

export default function StoreOverview() {
  const [stats, setStats] = useState(null);
  const [goal, setGoal] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetchStoreStats().then((data) => {
      if (isMounted) setStats(data);
    });
    fetchMonthlyGoal().then((data) => {
      if (isMounted) setGoal(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const pct = goal ? Math.min(100, (goal.current / goal.target) * 100) : 0;

  return (
    <div>
      <PixelBox
        tone="success"
        className="mt-6"
        contentClassName="flex flex-col items-center gap-3 px-5! py-6! text-center sm:px-8!"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] green-gradient-text tracking-[0.04em] uppercase">
            Monthly Goal
          </h2>
        </div>

        {!goal && (
          <p className="mt-2 text-[15px] gold-gradient-text">Loading...</p>
        )}

        {goal && (
          <>
            <div className="mt-2 flex w-full max-w-6xl items-baseline justify-between text-[11px] sm:text-[12px]">
              <span className="gradient-text text-[12px]">
                {goal.currency}
                {goal.current.toLocaleString()} raised
              </span>
              <span className="gold-gradient-text text-[12px]">
                {goal.currency}
                {goal.target.toLocaleString()} goal
              </span>
            </div>
            <div className="h-2.5 w-full max-w-6xl overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-(--color-success) transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10.5px] tracking-wider text-(--color-text-dim)">
              <span className="flex items-center gap-1 text-[12px] green-gradient-text">
                <Users size={15} color="#6fcb6b"/> {goal.supporters} supporters this month
              </span>
              <span className="flex items-center gap-1 text-[12px] gold-gradient-text">
                <Clock size={15} color="#ffc02e"/> {daysLeft(goal.endsAt)} days left
              </span>
            </div>
          </>
        )}
      </PixelBox>
      {stats && (
        <div className="mt-8 grid grid-cols-2 gap-4">
          <StatCard
            icon={totalVotes}
            value={`৳${stats.totalRaised.toLocaleString()}`}
            label="TOTAL RAISED"
          />
          <StatCard
            icon={totalRaised}
            value={stats.totalDonators.toLocaleString()}
            label="TOTAL DONATORS"
          />
        </div>
      )}
    </div>
  );
}
