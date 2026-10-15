import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  CheckCircle2,
  PartyPopper,
} from "lucide-react";
import PixelBox from "../components/ui/PixelBox";
import PixelButton from "../components/ui/PixelButton";
import { useCart } from "../context/useCart";
import { parsePrice } from "../context/cart-utils";
import { useSeo } from "../hooks/useSeo";

// Category -> accent color + label. Keeps every row's badge tied to the
// same theme colors used across the Store tabs (rank=gold, crate=info,
// currency=success) instead of re-deriving it per item.
const CATEGORY_STYLE = {
  rank: { label: "RANK", color: "var(--color-primary)" },
  crate: { label: "CRATE KEY", color: "var(--color-info)" },
  currency: { label: "CURRENCY", color: "var(--color-success)" },
};

function formatUSD(amount) {
  return `$${amount.toFixed(2)}`;
}

function ItemIcon({ item }) {
  if (item.image) {
    return (
      <img
        src={item.image}
        alt=""
        className="h-10 w-10 object-contain [image-rendering:pixelated]"
      />
    );
  }
  const Icon = item.icon;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-black/25">
      {Icon && <Icon size={18} color="#fff" strokeWidth={2.25} />}
    </span>
  );
}

function CartRow({ item }) {
  const { updateQty, removeFromCart } = useCart();
  const style = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.rank;
  const lineTotal = parsePrice(item.price) * item.qty;

  return (
    <div className="flex flex-col gap-3 border-b border-white/5 py-4 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex flex-1 items-center gap-3">
        <ItemIcon item={item} />

        <div className="min-w-0 flex-1">
          <span
            className="inline-block rounded-sm px-1.5 py-0.5 text-[8.5px] tracking-widest"
            style={{
              backgroundColor: `color-mix(in srgb, ${style.color} 18%, transparent)`,
              color: style.color,
            }}
          >
            {style.label}
          </span>
          <p className="truncate text-[13px] gradient-text">{item.name}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="flex items-center gap-1.5">
          <PixelButton
            tone="neutral"
            size="sm"
            className="px-2! py-2! gap-0!"
            icon={Minus}
            iconSize={12}
            aria-label={`Decrease ${item.name} quantity`}
            onClick={() => updateQty(item.id, item.qty - 1)}
          />
          <span className="w-6 text-center text-[12.5px] gold-gradient-text">
            {item.qty}
          </span>
          <PixelButton
            tone="neutral"
            size="sm"
            className="px-2! py-2! gap-0!"
            icon={Plus}
            iconSize={12}
            aria-label={`Increase ${item.name} quantity`}
            onClick={() => updateQty(item.id, item.qty + 1)}
          />
        </div>

        <span className="w-16 shrink-0 text-right text-[13px] gold-gradient-text">
          {formatUSD(lineTotal)}
        </span>

        <PixelButton
          tone="danger"
          size="sm"
          className="px-2.5! py-2.5! gap-0!"
          icon={Trash2}
          iconSize={13}
          aria-label={`Remove ${item.name} from cart`}
          onClick={() => removeFromCart(item.id)}
        />
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <PixelBox
      tone="neutral"
      className="mt-10"
      contentClassName="flex flex-col items-center gap-3 py-14 text-center"
    >
      <ShoppingCart size={30} className="text-(--color-text-dim)" />
      <h2 className="text-[15px] gold-gradient-text">Your cart is empty</h2>
      <p className="max-w-xs text-[11.5px] leading-relaxed text-(--color-text-muted)">
        Ranks, crates, keys, and currency you add from the Store will show up
        here.
      </p>
      <Link to="/store" className="mt-2">
        <PixelButton tone="primary" size="sm" className="px-5! py-4!">
          <span className="gold-gradient-text">Browse Store</span>
        </PixelButton>
      </Link>
    </PixelBox>
  );
}

function OrderPlaced({ onContinue }) {
  return (
    <PixelBox
      tone="success"
      filled
      className="mt-10"
      contentClassName="flex flex-col items-center gap-3 py-14 text-center"
    >
      <PartyPopper size={30} color="#fff" />
      <h2 className="text-[16px] green-gradient-text">Order placed!</h2>
      <p className="max-w-sm text-[11.5px] leading-relaxed text-white/80">
        Thanks for supporting BDZONE — your rewards will be waiting in-game
        the next time you log in.
      </p>
      <Link to="/store" className="mt-2" onClick={onContinue}>
        <PixelButton tone="neutral" size="sm" className="px-5! py-4!">
          Continue Shopping
        </PixelButton>
      </Link>
    </PixelBox>
  );
}

export default function Cart() {
  useSeo({ title: "Your Cart", path: "/cart", noindex: true });
  const { items, count, subtotal, clearCart } = useCart();
  const [placed, setPlaced] = useState(false);

  const handleCheckout = () => {
    setPlaced(true);
    clearCart();
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="title gold-gradient-text">Your Cart</h1>
      <p className="p">
        {count > 0
          ? `${count} item${count > 1 ? "s" : ""} ready for checkout`
          : "Nothing here yet"}
      </p>

      {placed && <OrderPlaced onContinue={() => setPlaced(false)} />}

      {!placed && items.length === 0 && <EmptyCart />}

      {!placed && items.length > 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <PixelBox
            tone="neutral"
            className="lg:col-span-2"
            contentClassName="flex flex-col"
            header={
              <span className="gradient-text uppercase">
                Cart Items ({count})
              </span>
            }
          >
            {items.map((item) => (
              <CartRow key={item.id} item={item} />
            ))}
          </PixelBox>

          <PixelBox
            tone="primary"
            className="h-fit lg:sticky lg:top-20"
            contentClassName="flex flex-col gap-4"
            header={<span className="gold-gradient-text uppercase">Order Summary</span>}
          >
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-(--color-text-muted)">Subtotal</span>
              <span className="gradient-text">{formatUSD(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[14px]">
              <span className="gradient-text">Total</span>
              <span className="gold-gradient-text">{formatUSD(subtotal)}</span>
            </div>

            <PixelButton
              tone="success"
              filled
              icon={CheckCircle2}
              className="mt-1 w-full py-5!"
              onClick={handleCheckout}
            >
              Checkout
            </PixelButton>

            <p className="text-center text-[10.5px] leading-relaxed text-(--color-text-dim)">
              Instant in-game delivery after checkout — no real payment is
              processed on this preview store.
            </p>
          </PixelBox>
        </div>
      )}
    </section>
  );
}
