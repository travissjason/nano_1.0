import React, { useId } from "react";

// Original local artwork: no external image requests are needed for the demo.
export default function AlbumArt({ song, className = "" }) {
  const id = useId().replaceAll(":", "");
  return (
    <div
      className={`album-art art-${song.id} ${className}`}
      aria-label={`${song.title} 앨범 아트`}
      role="img"
    >
      <svg viewBox="0 0 500 500" aria-hidden="true">
        <defs>
          <linearGradient id={`sky${id}`} x2=".7" y2="1">
            <stop stopColor={song.colors[0]} />
            <stop offset="1" stopColor={song.colors[1]} />
          </linearGradient>
          <radialGradient id={`sun${id}`}>
            <stop stopColor="#f5d6d0" stopOpacity=".5" />
            <stop offset="1" stopColor="#e9c9de" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`road${id}`} x2="0" y2="1">
            <stop stopColor="#c3a1b8" stopOpacity=".2" />
            <stop offset="1" stopColor="#10121e" />
          </linearGradient>
          <filter id={`noise${id}`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope=".12" />
            </feComponentTransfer>
          </filter>
        </defs>
        <rect width="500" height="500" fill={`url(#sky${id})`} />
        <circle cx="325" cy="175" r="170" fill={`url(#sun${id})`} />
        {Array.from({ length: 35 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 83 + 31) % 500}
            cy={(i * 47 + 17) % 270}
            r={i % 4 === 0 ? 1.4 : 0.7}
            fill="white"
            opacity={0.2 + (i % 4) * 0.15}
          />
        ))}
        {song.id === "city" ? (
          <>
            <circle cx="340" cy="195" r="58" fill="#dca0a0" opacity=".65" />
            {Array.from({ length: 15 }, (_, i) => (
              <g key={i}>
                <rect
                  x={i * 37 - 15}
                  y={220 + ((i * 31) % 80)}
                  width="30"
                  height="230"
                  fill={i % 2 ? "#17202c" : "#202331"}
                />
                {Array.from({ length: 7 }, (_, j) => (
                  <rect
                    key={j}
                    x={i * 37 - 7}
                    y={235 + ((i * 31) % 80) + j * 20}
                    width="4"
                    height="7"
                    fill="#e6c1a1"
                    opacity={j % 3 ? 0.65 : 0.15}
                  />
                ))}
              </g>
            ))}
            <path
              d="M190 500L250 330L270 330L340 500"
              fill="#bd8a9a"
              opacity=".3"
            />
          </>
        ) : (
          <>
            <circle
              cx={song.id === "midnight" ? 340 : 365}
              cy={song.id === "night" ? 105 : 210}
              r={song.id === "night" ? 21 : 48}
              fill="#ecdcce"
              opacity={song.id === "night" ? 0.85 : 0.55}
            />
            <path
              d="M0 320L70 243L115 274L194 172L280 280L345 219L500 340V500H0Z"
              fill="#22283a"
              opacity=".65"
            />
            <path
              d="M0 380L90 280L155 336L230 267L320 347L430 259L500 312V500H0Z"
              fill="#151e2d"
            />
            <path
              d="M0 427L120 341L210 375L270 335L375 391L500 334V500H0Z"
              fill="#111923"
            />
            <path
              d="M174 500C200 442 335 422 265 384C249 374 253 366 274 354C239 364 231 378 248 390C301 428 140 433 99 500Z"
              fill={`url(#road${id})`}
            />
            <path
              d="M135 500C176 447 313 425 257 387"
              stroke="#e0b7ba"
              strokeWidth="2"
              fill="none"
              opacity=".6"
            />
          </>
        )}
        <rect
          width="500"
          height="500"
          filter={`url(#noise${id})`}
          opacity=".5"
        />
      </svg>
      <div className="cover-type">
        <span>{song.artist}</span>
        <strong>
          {song.id === "night" ? (
            <>
              NIGHT
              <br />
              DRIVE
            </>
          ) : song.id === "city" ? (
            <>
              CITY
              <br />
              LIGHTS
            </>
          ) : song.id === "season" ? (
            <>
              our
              <br />
              season.
            </>
          ) : song.id === "midnight" ? (
            <>
              MIDNIGHT
              <br />
              RUN
            </>
          ) : (
            <>
              DREAM
              <br />
              ROUTE
            </>
          )}
        </strong>
        <small>{song.subtitle}</small>
      </div>
    </div>
  );
}
