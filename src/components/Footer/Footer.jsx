import { Link } from "react-router-dom";
import { Code2, MessageCircle, PlayCircle, X as XIcon } from "lucide-react";
import "./Footer.css";

const columns = [
  {
    heading: "Product",
    links: [
      { label: "News", to: "/news" },
      { label: "Vote", to: "/votes" },
      { label: "Store", to: "/store" },
      { label: "Ranks", to: "/ranks" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Staff", to: "/staff" },
      { label: "Support", to: "/support" },
      { label: "Terms", to: "/terms" },
      { label: "Privacy", to: "/privacy" },
    ],
  },
];

const socials = [
  { icon: MessageCircle, label: "Discord", href: "#" },
  { icon: XIcon, label: "X", href: "#" },
  { icon: PlayCircle, label: "YouTube", href: "#" },
  { icon: Code2, label: "GitHub", href: "#" },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__logo">CRAFTVERSE</span>
          <p className="site-footer__tagline">The Minecraft client built for every player.</p>
          <div className="site-footer__socials">
            {socials.map(({ icon: Icon, label, href }) => (
              <a key={label} href={href} aria-label={label} className="site-footer__social">
                <Icon size={16} strokeWidth={2} />
              </a>
            ))}
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.heading} className="site-footer__col">
            <h3>{col.heading}</h3>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="site-footer__bottom">
        <span>&copy; {new Date().getFullYear()} Craftverse. All rights reserved.</span>
      </div>
    </footer>
  );
}
