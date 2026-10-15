import defaultBtn from "../../assets/buttons/default-button.png";
import "./PixelPanel.css";

export default function PixelPanel({ children, className = "" }) {
  return (
    <div
      className={`pixel-panel ${className}`}
      style={{ "--panel-bg": `url(${defaultBtn})` }}
    >
      {children}
    </div>
  );
}
