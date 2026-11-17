import { useEffect, useState } from "react";
import { getLocalDate } from "./dates";

export function useToday(): string {
  const [today, setToday] = useState(() => getLocalDate());

  useEffect(() => {
    function updateToday() {
      setToday(getLocalDate());
    }

    const interval = window.setInterval(updateToday, 60000);
    document.addEventListener("visibilitychange", updateToday);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateToday);
    };
  }, []);

  return today;
}
