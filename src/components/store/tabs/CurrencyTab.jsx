import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import PixelBox from "../../ui/PixelBox";
import PixelButton from "../../ui/PixelButton";
import { fetchCurrencyPacks } from "../../../data/store";
import { useCart } from "../../../context/useCart";
import coinIcon from "../../../assets/votes/coin.png";

export default function CurrencyTab() {
  const [packs, setPacks] = useState(null);
  const [addedKey, setAddedKey] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    let isMounted = true;
    fetchCurrencyPacks().then((data) => {
      if (isMounted) setPacks(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddToCart = (pack) => {
    addToCart({
      id: `currency-${pack.key}`,
      category: "currency",
      name: pack.name,
      price: pack.price,
      tone: pack.tone,
      image: coinIcon,
    });
    setAddedKey(pack.key);
    setTimeout(() => setAddedKey((k) => (k === pack.key ? null : k)), 1500);
  };

  return (
    <div className="mt-8">
      {!packs && (
        <p className="py-10 text-center text-[12px] text-(--color-text-dim)">Loading...</p>
      )}

      {packs && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {packs.map((pack) => (
            <PixelBox
              key={pack.key}
              tone={pack.tone}
              filled={pack.featured}
              contentClassName="flex h-full flex-col items-center gap-3 text-center"
            >
              <img
                src={coinIcon}
                alt=""
                className="h-12 w-12 object-contain [image-rendering:pixelated]"
              />
              <h3 className="text-[13px] gradient-text ">{pack.name}</h3>
              <span className="text-[12px] green-gradient-text font-semibold">
                {pack.amount}
              </span>
              {pack.bonus && (
                <span className="rounded-sm bg-(--color-success)/15 px-2 py-0.5 text-[9.5px]  uppercase tracking-[0.04em] gold-gradient-text ">
                  {pack.bonus}
                </span>
              )}
              <div
                className="mt-1 text-[18px] gold-gradient-text "
              >
                {pack.price}
              </div>
              <PixelButton
                tone={pack.tone}
                className="mt-auto w-full"
                filled={pack.featured}
                icon={addedKey === pack.key ? Check : undefined}
                onClick={() => handleAddToCart(pack)}
              >
                <span className="gold-gradient-text ">
                  {addedKey === pack.key ? "Added!" : "Purchase"}
                </span>
              </PixelButton>
            </PixelBox>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-[11.5px] text-(--color-text-dim)">
        In-game currency is delivered instantly and can be spent at player shops or the auction house.
      </p>
    </div>
  );
}
