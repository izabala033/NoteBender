import { useTranslation } from "react-i18next";

export default function NotationSwitch() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isSolfege = language.startsWith("solfege");

  const setLanguage = (nextLanguage: "en" | "solfege") => {
    if (nextLanguage === language) return;
    i18n.changeLanguage(nextLanguage);
  };

  return (
    <div className="app-segmented" role="group" aria-label="Notation display">
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={!isSolfege}
        className={`app-segment ${!isSolfege ? "app-segment-active" : ""}`}
      >
        A B C
      </button>
      <button
        type="button"
        onClick={() => setLanguage("solfege")}
        aria-pressed={isSolfege}
        className={`app-segment ${isSolfege ? "app-segment-active" : ""}`}
      >
        Do Re Mi
      </button>
    </div>
  );
}
