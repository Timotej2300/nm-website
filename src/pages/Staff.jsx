import { Crown, ShieldCheck, Gavel, Hammer, MessageCircle, Sparkles } from "lucide-react";
import PixelBox from "../components/ui/PixelBox";
import PixelButton from "../components/ui/PixelButton";
import { STAFF, STAFF_TIERS } from "../data/staff";
import { avatarUrl } from "../data/votes";
import { useSeo } from "../hooks/useSeo";

// Tier -> visual identity. Tone drives the PixelBox border art; textClass
// colors the name/heading; badgeClass tints the role pill; icon marks the
// section header.
const TIER_STYLE = {
  owner: {
    tone: "primary",
    textClass: "gold-gradient-text",
    badgeClass: "bg-(--color-primary)/15 text-(--color-primary)",
    icon: Crown,
  },
  admin: {
    tone: "pink",
    textClass: "text-(--color-pink)",
    badgeClass: "bg-(--color-pink)/15 text-(--color-pink)",
    icon: ShieldCheck,
  },
  moderator: {
    tone: "info",
    textClass: "info-gradient-text",
    badgeClass: "bg-(--color-info)/15 text-(--color-info)",
    icon: Gavel,
  },
  helper: {
    tone: "success",
    textClass: "green-gradient-text",
    badgeClass: "bg-(--color-success)/15 text-(--color-success)",
    icon: Hammer,
  },
};

function StatusDot({ online, size = "h-3 w-3" }) {
  return (
    <span
      className={`absolute -right-0.5 -bottom-0.5 ${size} rounded-full border-2 border-(--color-bg) ${
        online ? "bg-(--color-success)" : "bg-(--color-text-dim)"
      }`}
      title={online ? "Online" : "Offline"}
    />
  );
}

function RoleBadge({ role, badgeClass }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold tracking-[0.06em] uppercase ${badgeClass}`}
    >
      {role}
    </span>
  );
}

function DiscordTag({ handle }) {
  return (
    <span className="mt-1 flex items-center gap-1.5 rounded-sm bg-black/25 px-2.5 py-1 text-[10.5px] text-(--color-text-muted)">
      <MessageCircle size={11} />@{handle}
    </span>
  );
}

function SpotlightCard({ member, style }) {
  return (
    <PixelBox
      tone={style.tone}
      filled
      className="mt-4 transition-transform hover:-translate-y-0.5"
      contentClassName="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left"
    >
      <div className="relative shrink-0">
        <img
          src={avatarUrl(member.username, 80)}
          alt={member.username}
          className="h-20 w-20 rounded-sm ring-2 ring-black/40 [image-rendering:pixelated]"
        />
        <StatusDot online={member.online} size="h-4 w-4" />
      </div>
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <span className={`text-[18px] ${style.textClass}`}>{member.username}</span>
        <RoleBadge role={member.role} badgeClass={style.badgeClass} />
        <p className="mt-1 max-w-md text-[12px] leading-relaxed text-(--color-text-muted)">
          {member.bio}
        </p>
        <DiscordTag handle={member.discord} />
      </div>
    </PixelBox>
  );
}

function MemberCard({ member, style }) {
  return (
    <PixelBox
      tone={style.tone}
      className="transition-transform hover:-translate-y-0.5"
      contentClassName="flex flex-col items-center gap-2 text-center"
    >
      <div className="relative">
        <img
          src={avatarUrl(member.username, 56)}
          alt={member.username}
          className="h-14 w-14 rounded-sm ring-1 ring-black/40 [image-rendering:pixelated]"
        />
        <StatusDot online={member.online} />
      </div>
      <span className={`text-[13px] ${style.textClass}`}>{member.username}</span>
      <RoleBadge role={member.role} badgeClass={style.badgeClass} />
      <p className="text-[11px] leading-snug text-(--color-text-dim)">{member.bio}</p>
      <DiscordTag handle={member.discord} />
    </PixelBox>
  );
}

function TierSection({ tier, isFirst }) {
  const style = TIER_STYLE[tier.key];
  const Icon = style.icon;
  const members = STAFF.filter((m) => m.tier === tier.key);
  if (members.length === 0) return null;

  return (
    <div className={`mt-10 ${isFirst ? "" : "border-t border-white/5 pt-10"}`}>
      <h2
        className={`flex items-center gap-2 text-[13px] tracking-[0.08em] uppercase ${style.textClass}`}
      >
        <Icon size={15} />
        {tier.label}
        <span className="text-(--color-text-dim) normal-case">({members.length})</span>
      </h2>

      {tier.key === "owner" ? (
        members.map((m) => <SpotlightCard key={m.username} member={m} style={style} />)
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {members.map((m) => (
            <MemberCard key={m.username} member={m} style={style} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Staff() {
   useSeo({
    title: "Staff",
    description:
      "Meet the BDZONE team — owners, admins, moderators, and helpers who build and run the server.",
    path: "/staff",
  });

  const onlineCount = STAFF.filter((m) => m.online).length;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="title gold-gradient-text">Staff</h1>
      <p className="p">
        The people building, running, and moderating BDZONE — say hi if you
        spot us in-game or on Discord.
      </p>
      <p className="mt-1 text-center text-[11px] text-(--color-text-dim)">
        <span className="text-(--color-success)">●</span> {onlineCount} of{" "}
        {STAFF.length} team members online right now
      </p>

      {STAFF_TIERS.map((tier, i) => (
        <TierSection key={tier.key} tier={tier} isFirst={i === 0} />
      ))}

      <PixelBox
        tone="neutral"
        className="mt-10"
        contentClassName="flex flex-col items-center gap-3 py-8 text-center"
      >
        <Sparkles size={18} className="text-(--color-primary)" />
        <h3 className="text-[14px] gold-gradient-text ">Want to join the team?</h3>
        <p className="max-w-sm text-[11.5px] leading-relaxed text-(--color-text-muted)">
          We open staff applications every season. Active, helpful players
          get noticed first.
        </p>
        <PixelButton tone="primary" size="sm" className="mt-1 px-4! py-4!">
          <span className="gold-gradient-text ">Apply on Discord</span>
        </PixelButton>
      </PixelBox>
    </section>
  );
}