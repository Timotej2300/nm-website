import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import PixelBox from "../../ui/PixelBox";
import PixelButton from "../../ui/PixelButton";
import { fetchCrateKeys } from "../../../data/store";
import { useCart } from "../../../context/useCart";
import keyIcon from "../../../assets/votes/key.png";

export default function CratesTab() {
  const [keys, setKeys] = useState(null);
  const [addedKey, setAddedKey] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    let isMounted = true;
    fetchCrateKeys().then((data) => {
      if (isMounted) setKeys(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddToCart = (crate) => {
    addToCart({
      id: `crate-${crate.key}`,
      category: "crate",
      name: crate.name,
      price: crate.price,
      tone: crate.tone,
      image: keyIcon,
    });
    setAddedKey(crate.key);
    setTimeout(() => setAddedKey((k) => (k === crate.key ? null : k)), 1500);
  };

  return (
    <div className="mt-8">
      {!keys && (
        <p className="py-10 text-center text-[15px] gold-gradient-text ">Loading...</p>
      )}

      {keys && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {keys.map((crate) => (
            <PixelBox
              key={crate.key}
              tone={crate.tone}
              filled={crate.featured}
              contentClassName="flex h-full flex-col items-center gap-3 text-center"
            >
              <img
                src={keyIcon}
                alt=""
                className="h-12 w-12 object-contain [image-rendering:pixelated]"
              />
              <h3 className="text-[13px] gradient-text ">{crate.name}</h3>
              <div
                className="text-[18px] gold-gradient-text "
              >
                {crate.price}
              </div>
              <ul className="flex flex-col gap-1.5">
                {crate.contents.map((line) => (
                  <li key={line} className="text-[11px] gradient-text ">
                    {line}
                  </li>
                ))}
              </ul>
              <PixelButton
                tone={crate.tone}
                className="mt-auto w-full"
                filled={crate.featured}
                icon={addedKey === crate.key ? Check : undefined}
                onClick={() => handleAddToCart(crate)}
              >
                <span className="gold-gradient-text ">
                  {addedKey === crate.key ? "Added!" : "Buy Key"}
                </span>
              </PixelButton>
            </PixelBox>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-[11.5px] text-(--color-text-dim)">
        Keys open at the in-game crate room — spend Vote Points to open crates for free too.
      </p>
    </div>
  );
}
