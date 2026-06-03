"use client";

import { useEffect, useState } from "react";

const MIN_INTERVAL_MS = 9000;
const MAX_INTERVAL_MS = 16000;
const FLY_DURATION_MS = 5200;

function randomDelay() {
  return MIN_INTERVAL_MS + Math.floor(Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS));
}

export function NyanCatFlyby() {
  const [flying, setFlying] = useState(false);

  useEffect(() => {
    let flyTimeout: ReturnType<typeof setTimeout>;
    let scheduleTimeout: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      scheduleTimeout = setTimeout(() => {
        setFlying(true);
        flyTimeout = setTimeout(() => {
          setFlying(false);
          scheduleNext();
        }, FLY_DURATION_MS);
      }, randomDelay());
    };

    const firstRun = setTimeout(() => {
      setFlying(true);
      flyTimeout = setTimeout(() => {
        setFlying(false);
        scheduleNext();
      }, FLY_DURATION_MS);
    }, 2500);

    return () => {
      clearTimeout(firstRun);
      clearTimeout(flyTimeout);
      clearTimeout(scheduleTimeout);
    };
  }, []);

  return (
    <div className="nyanCatLane" aria-hidden="true">
      <div className={`nyanCatRunner ${flying ? "flying" : ""}`}>
        <div className="nyanRainbow">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="nyanCatBody">
          <div className="nyanPopTart" />
          <div className="nyanHead">
            <span className="nyanEar nyanEarLeft" />
            <span className="nyanEar nyanEarRight" />
            <span className="nyanEye nyanEyeLeft">◉</span>
            <span className="nyanEye nyanEyeRight">◉</span>
            <span className="nyanMouth">ω</span>
            <span className="nyanBlush nyanBlushLeft" />
            <span className="nyanBlush nyanBlushRight" />
          </div>
        </div>
      </div>
    </div>
  );
}
