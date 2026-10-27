import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Disc3,
  Headphones,
  Heart,
  House,
  ListMusic,
  Mic2,
  Music2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import AlbumArt from "./AlbumArt.jsx";
import { songs, timeLabel, readStored, writeStored } from "./data.js";

function Brand({ large = false }) {
  return (
    <div className={`brand ${large ? "brand-large" : ""}`}>
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M8 30V14a6 6 0 0 1 12 0v12a6 6 0 0 0 12 0V10"
          stroke="currentColor"
          strokeWidth="4.3"
          strokeLinecap="round"
        />
      </svg>
      <span>
        나노 <small>NANO</small>
      </span>
    </div>
  );
}

function Waveform({ active = false, small = false }) {
  return (
    <div
      className={`waveform ${active ? "active" : ""} ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: small ? 16 : 44 }, (_, i) => (
        <i
          key={i}
          style={{
            "--h": `${12 + ((i * 17 + i * i * 3) % 42)}px`,
            "--delay": `${(i % 9) * -0.16}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("intro");
  const [song, setSong] = useState(songs[0]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [karaoke, setKaraoke] = useState(false);
  const [reverb, setReverb] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("전체");
  const [favorites, setFavorites] = useState(() =>
    readStored("nano-favorites", ["night", "season"]),
  );
  const [recent, setRecent] = useState(() => readStored("nano-recent", []));
  const [saved, setSaved] = useState(() => readStored("nano-sessions", []));
  const [session, setSession] = useState(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [playlistTab, setPlaylistTab] = useState("recent");
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  const [volume, setVolume] = useState(72);
  const toastTimer = useRef();

  useEffect(() => {
    writeStored("nano-favorites", favorites);
  }, [favorites]);
  useEffect(() => {
    writeStored("nano-recent", recent);
  }, [recent]);
  useEffect(() => {
    writeStored("nano-sessions", saved);
  }, [saved]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (!playing || screen !== "player") return;
    const timer = setInterval(
      () => setProgress((p) => Math.min(p + 1, song.duration)),
      1000,
    );
    return () => clearInterval(timer);
  }, [playing, screen, song.duration]);
  useEffect(() => {
    if (screen === "player" && progress >= song.duration) finishSession();
  }, [progress, screen, song.duration]);
  useEffect(() => {
    if (!help) return;
    const listener = (e) => {
      if (e.key === "Escape") setHelp(false);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [help]);

  function notify(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }
  function navigate(next) {
    setScreen(next);
    if (next !== "player") setPlaying(false);
    window.scrollTo({ top: 0 });
  }
  function startSong(selected) {
    setSong(selected);
    setProgress(0);
    setPlaying(true);
    setSessionSaved(false);
    setRecent((old) =>
      [selected.id, ...old.filter((id) => id !== selected.id)].slice(0, 5),
    );
    setScreen("player");
    window.scrollTo({ top: 0 });
  }
  function nextSong(direction) {
    startSong(
      songs[
        (songs.findIndex((s) => s.id === song.id) + direction + songs.length) %
          songs.length
      ],
    );
  }
  function toggleFavorite(selected) {
    const has = favorites.includes(selected.id);
    setFavorites((old) =>
      has ? old.filter((id) => id !== selected.id) : [...old, selected.id],
    );
    notify(has ? "즐겨찾기에서 삭제했어요" : "즐겨찾기에 담았어요");
  }
  function toggleKaraoke() {
    setKaraoke(!karaoke);
    if (karaoke) setReverb(false);
  }
  function finishSession() {
    setPlaying(false);
    setSession({
      id: Date.now(),
      songId: song.id,
      duration: progress,
      karaoke,
      reverb,
      date: new Date().toISOString(),
    });
    setSessionSaved(false);
    setScreen("result");
  }
  function saveSession() {
    if (sessionSaved || !session) return;
    setSaved((old) => [session, ...old].slice(0, 20));
    setSessionSaved(true);
    notify("이 브라우저에 세션 기록을 저장했어요");
  }

  const filtered = songs.filter(
    (s) =>
      `${s.title} ${s.artist} ${s.genre}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "전체" || s.genre === filter) &&
      (screen !== "favorites" || favorites.includes(s.id)),
  );
  const recentSongs = recent
    .map((id) => songs.find((s) => s.id === id))
    .filter(Boolean);
  const playlist =
    playlistTab === "recent"
      ? recentSongs
      : songs.filter((s) => favorites.includes(s.id));

  function FavoriteButton({ selected, className = "" }) {
    const active = favorites.includes(selected.id);
    return (
      <button
        className={`icon-button heart ${active ? "is-favorite" : ""} ${className}`}
        aria-label={`${selected.title} 즐겨찾기 ${active ? "해제" : "추가"}`}
        aria-pressed={active}
        onClick={() => toggleFavorite(selected)}
      >
        <Heart size={19} fill={active ? "currentColor" : "none"} />
      </button>
    );
  }

  function SongRow({ selected, index, showNumber = false }) {
    return (
      <div className="song-row">
        {showNumber && (
          <span className="track-number">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        <button
          className="row-song"
          onClick={() => startSong(selected)}
          aria-label={`${selected.title} 재생`}
        >
          <AlbumArt song={selected} />
          <span>
            <strong>{selected.title}</strong>
            <small>
              {selected.artist} <span className="dot">·</span> {selected.genre}
            </small>
          </span>
        </button>
        <span className="track-time">{timeLabel(selected.duration)}</span>
        <FavoriteButton selected={selected} />
        <button
          className="icon-button row-play"
          aria-label={`${selected.title} 노래 시작`}
          onClick={() => startSong(selected)}
        >
          <Play size={17} fill="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <div className={`app ${screen === "intro" ? "is-intro" : ""}`}>
      <aside className="sidebar">
        <button
          className="brand-mark"
          onClick={() => navigate("intro")}
          aria-label="나노 인트로"
        >
          <Brand />
        </button>
        <div className="sidebar-divider" />
        <nav aria-label="주 메뉴">
          {[
            ["home", House, "홈"],
            ["songs", Disc3, "곡 찾기"],
            ["favorites", Heart, "즐겨찾기"],
            ["history", Clock3, "내 세션"],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              className={`nav-item ${screen === id || (id === "songs" && screen === "player") ? "selected" : ""}`}
              onClick={() => {
                setQuery("");
                setFilter("전체");
                navigate(id);
              }}
              aria-current={screen === id ? "page" : undefined}
            >
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="connection-dot" />
          <span className="connected">CONNECTED</span>
          <button
            className="icon-button"
            aria-label="데모 이용 안내"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={21} />
          </button>
        </div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <button
            className="header-brand"
            onClick={() => navigate("home")}
            aria-label="나노 홈"
          >
            <Brand />
          </button>
          <span className="header-description">MY CAR, MY KARAOKE</span>
          <div className="topbar-right">
            <span className="parked-badge">
              <span />
              PARKED <i /> 정차 중
            </span>
            <span className="header-divider" />
            <button
              className="profile"
              onClick={() => setHelp(true)}
              aria-label="나노 데모 정보"
            >
              <Headphones size={18} />
              <span>나만의 공간</span>
            </button>
          </div>
        </header>

        <main key={screen} className={`main main-${screen}`}>
          {screen === "intro" && (
            <section className="intro-screen">
              <img
                className="intro-cabin"
                src="/cabin.svg"
                alt="보랏빛 조명과 밤하늘이 감싸는 차량 실내"
              />
              <div className="intro-shade" />
              <div className="intro-content">
                <div className="eyebrow">
                  <span className="tiny-line" /> A SPACE THAT SOUNDS LIKE YOU
                </div>
                <Brand large />
                <h1>
                  당신의 자동차를,
                  <br />
                  나만의 노래방으로.
                </h1>
                <p>나만에 의한, 나만을 위한, 나만의 노래방</p>
                <button
                  className="primary-button"
                  onClick={() => navigate("home")}
                >
                  나만의 무대 시작하기 <ArrowRight size={20} />
                </button>
                <div className="intro-note">
                  <ShieldCheck size={16} /> 정차한 순간, 새로운 즐거움이
                  시작됩니다.
                </div>
              </div>
              <div className="intro-caption">
                <Waveform active small />
                <span>
                  YOUR CAR.
                  <br />
                  <strong>YOUR STAGE.</strong>
                </span>
              </div>
              <span className="intro-edition">
                NANO EXPERIENCE · CONCEPT DEMO 01
              </span>
            </section>
          )}

          {screen === "home" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow muted">WELCOME TO YOUR SPACE</div>
                  <h1>오늘, 나를 위한 한 곡.</h1>
                  <p>오늘도 나만의 무대는 차 안에서 시작됩니다.</p>
                </div>
                <form
                  className="home-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setFilter("전체");
                    navigate("songs");
                  }}
                >
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="홈에서 곡 검색"
                    placeholder="어떤 노래를 찾으세요?"
                  />
                  <button
                    className="icon-button"
                    type="submit"
                    aria-label="검색 결과 보기"
                  >
                    <Search size={18} />
                  </button>
                </form>
              </div>
              <section className="home-hero">
                <img
                  src="/cabin.svg"
                  alt="네온 조명이 흐르는 나만의 차량 실내"
                />
                <div className="hero-shade" />
                <div className="hero-content">
                  <span className="eyebrow">YOUR CAR. YOUR STAGE.</span>
                  <h2>
                    가장 편안한 공간이
                    <br />
                    가장 특별한 무대로.
                  </h2>
                  <p>나만에 의한, 나만을 위한, 나만의 노래방</p>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setQuery("");
                      setFilter("전체");
                      navigate("songs");
                    }}
                  >
                    <Mic2 size={19} />
                    노래 시작하기 <ArrowRight size={19} />
                  </button>
                </div>
                <div className="hero-mode">
                  <span className="live-dot" /> NANO EXPERIENCE
                </div>
                <div className="hero-corner">
                  <Waveform active small />
                  <span>온전히, 나에게 맞춘 사운드</span>
                </div>
              </section>
              <div className="safety-note">
                <ShieldCheck size={15} />
                <span>안전하게 멈춘 지금, 마음껏 즐겨보세요.</span>
                <span className="safety-end">
                  노래방 모드는 정차 중에만 이용할 수 있습니다.
                </span>
              </div>
              <div className="home-lower">
                <section className="recommendations">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow muted">CURATED FOR YOU</span>
                      <h2>지금, 이 분위기에 어울리는 곡</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("songs")}
                    >
                      전체 보기 <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="album-grid">
                    {songs.slice(0, 4).map((s) => (
                      <article className="album-card" key={s.id}>
                        <div className="album-image-wrap">
                          <button
                            className="album-open"
                            onClick={() => startSong(s)}
                            aria-label={`${s.title} 재생`}
                          >
                            <AlbumArt song={s} />
                            <span className="card-play">
                              <Play size={22} fill="currentColor" />
                            </span>
                          </button>
                          <FavoriteButton selected={s} />
                          <span className="mood-label">{s.mood}</span>
                        </div>
                        <button
                          className="album-title"
                          onClick={() => startSong(s)}
                        >
                          {s.title}
                        </button>
                        <span className="album-artist">
                          {s.artist}
                          <i /> {s.genre}
                        </span>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="playlist">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow muted">MADE BY YOU</span>
                      <h2>나의 플레이리스트</h2>
                    </div>
                    <ListMusic size={20} />
                  </div>
                  <div className="segmented">
                    <button
                      className={playlistTab === "recent" ? "active" : ""}
                      onClick={() => setPlaylistTab("recent")}
                    >
                      최근 재생
                    </button>
                    <button
                      className={playlistTab === "favorites" ? "active" : ""}
                      onClick={() => setPlaylistTab("favorites")}
                    >
                      즐겨찾기 <span>{favorites.length}</span>
                    </button>
                  </div>
                  <div className="playlist-tracks">
                    {playlist.length ? (
                      playlist
                        .slice(0, 3)
                        .map((s, i) => (
                          <SongRow key={s.id} selected={s} index={i} />
                        ))
                    ) : (
                      <div className="playlist-empty">
                        <Headphones size={28} />
                        <strong>첫 번째 노래를 기다리고 있어요</strong>
                        <p>좋아하는 노래로 나만의 공간을 채워보세요.</p>
                        <button
                          className="text-button"
                          onClick={() => navigate("songs")}
                        >
                          곡 둘러보기 <ArrowRight size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>
              <div className="home-footer">
                <span>
                  <span className="live-dot" /> GOOD VIBES, SAFE DRIVES.
                </span>
                <span>오직 나를 위한 드라이빙 사운드.</span>
                <span>
                  INTERFACE DEMO <span className="version">v.01</span>
                </span>
              </div>
            </>
          )}

          {(screen === "songs" || screen === "favorites") && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow muted">
                    {screen === "favorites"
                      ? "YOUR PERSONAL COLLECTION"
                      : "FIND YOUR NEXT FAVORITE"}
                  </div>
                  <h1>
                    {screen === "favorites"
                      ? "좋아하는 마음을 모아서."
                      : "지금 부르고 싶은 노래는?"}
                  </h1>
                  <p>
                    {screen === "favorites"
                      ? "내 취향으로 채운, 나만의 플레이리스트."
                      : "오늘의 기분에 어울리는 곡을 골라보세요."}
                  </p>
                </div>
                <Music2 className="heading-icon" size={35} />
              </div>
              <label className="search-box">
                <Search size={22} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="곡 제목, 아티스트 또는 장르 검색"
                  aria-label="곡 검색"
                />
                {query && (
                  <button
                    className="icon-button"
                    onClick={() => setQuery("")}
                    aria-label="검색어 지우기"
                  >
                    <X size={18} />
                  </button>
                )}
                <span className="search-hint">나만의 한 곡을 찾아보세요</span>
              </label>
              <div className="genre-tabs" aria-label="장르 필터">
                {[
                  "전체",
                  "감성 발라드",
                  "시티 팝",
                  "인디 팝",
                  "신스 팝",
                  "드림 팝",
                ].map((genre) => (
                  <button
                    aria-pressed={filter === genre}
                    className={filter === genre ? "active" : ""}
                    onClick={() => setFilter(genre)}
                    key={genre}
                  >
                    {genre}
                  </button>
                ))}
              </div>
              <section className="song-library">
                <div className="section-heading">
                  <h2>
                    {screen === "favorites" ? "나의 즐겨찾기" : "NANO 셀렉션"}{" "}
                    <span className="count">{filtered.length}</span>
                  </h2>
                  <span className="demo-music-label">
                    시연용 오리지널 곡 <span>·</span> 오디오 미포함
                  </span>
                </div>
                {filtered.map((s, i) => (
                  <SongRow selected={s} key={s.id} index={i} showNumber />
                ))}
                {!filtered.length && (
                  <div className="empty-state">
                    <Search size={32} />
                    <h2>
                      {screen === "favorites" && !query
                        ? "아직 담아둔 곡이 없어요"
                        : "일치하는 곡이 없어요"}
                    </h2>
                    <p>
                      {screen === "favorites" && !query
                        ? "곡 옆의 하트를 눌러 나만의 리스트를 만들어보세요."
                        : "다른 검색어나 장르로 다시 찾아보세요."}
                    </p>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setQuery("");
                        setFilter("전체");
                        navigate("songs");
                      }}
                    >
                      전체 곡 보기
                    </button>
                  </div>
                )}
              </section>
              <div className="library-note">
                <Sparkles size={17} />
                <span>모든 순간이 나만의 무대가 되도록.</span>
                <span>NANO ORIGINAL COLLECTION</span>
              </div>
            </>
          )}

          {screen === "player" && (
            <>
              <div className="player-heading">
                <button
                  className="text-button"
                  onClick={() => navigate("songs")}
                >
                  <ArrowLeft size={18} /> 곡 목록
                </button>
                <span className={`mode-pill ${karaoke ? "on" : ""}`}>
                  <span className="live-dot" />
                  {karaoke ? "NANO MODE ON" : "MUSIC MODE"}
                </span>
                <button
                  className="text-button finish-button"
                  onClick={finishSession}
                >
                  <Square size={13} fill="currentColor" /> 세션 마치기
                </button>
              </div>
              <section
                className={`player-stage ${karaoke ? "karaoke-on" : ""} ${reverb ? "reverb-on" : ""}`}
              >
                <div className="now-playing">
                  <div className="eyebrow muted">YOUR MOMENT, YOUR MUSIC</div>
                  <div
                    className={`player-art-wrap ${playing ? "is-playing" : ""}`}
                  >
                    <AlbumArt song={song} />
                    <span className="art-orbit orbit-one" />
                    <span className="art-orbit orbit-two" />
                  </div>
                  <div className="player-song-info">
                    <div>
                      <h1>{song.title}</h1>
                      <p>
                        {song.artist} <span>·</span> {song.genre}
                      </p>
                    </div>
                    <FavoriteButton selected={song} />
                  </div>
                  <div className="progress-area">
                    <input
                      className="progress-slider"
                      type="range"
                      min="0"
                      max={song.duration}
                      value={progress}
                      style={{
                        "--progress": `${(progress / song.duration) * 100}%`,
                      }}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      aria-label="재생 위치"
                    />
                    <div>
                      <span>{timeLabel(progress)}</span>
                      <span>{timeLabel(song.duration)}</span>
                    </div>
                  </div>
                  <div className="playback-controls">
                    <button
                      className="icon-button"
                      onClick={() => nextSong(-1)}
                      aria-label="이전 곡"
                    >
                      <SkipBack size={24} fill="currentColor" />
                    </button>
                    <button
                      className="play-button"
                      onClick={() => setPlaying(!playing)}
                      aria-label={playing ? "일시정지" : "재생"}
                    >
                      {playing ? (
                        <Pause size={26} fill="currentColor" />
                      ) : (
                        <Play size={26} fill="currentColor" />
                      )}
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => nextSong(1)}
                      aria-label="다음 곡"
                    >
                      <SkipForward size={24} fill="currentColor" />
                    </button>
                  </div>
                  <label className="volume-control">
                    <Volume2 size={16} />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      aria-label="데모 볼륨"
                    />
                    <span>{volume}%</span>
                  </label>
                </div>
                <div className="karaoke-panel">
                  <div className="lyrics-heading">
                    <span className="eyebrow">
                      {karaoke ? "SING IT YOUR WAY" : "FEEL THE MUSIC"}
                    </span>
                    <span className="demo-badge">LYRICS DEMO</span>
                  </div>
                  <div className="lyrics" aria-live="off">
                    {song.lyrics.map((line, i) => {
                      const active = Math.min(
                        Math.floor(
                          progress / (song.duration / song.lyrics.length),
                        ),
                        song.lyrics.length - 1,
                      );
                      return (
                        <p
                          key={line}
                          className={
                            i === active ? "current" : i < active ? "past" : ""
                          }
                        >
                          {line}
                          {i === active && <span className="lyric-dot" />}
                        </p>
                      );
                    })}
                  </div>
                  <div className="mode-visual">
                    <Waveform active={playing && karaoke} />
                    <span>
                      {reverb
                        ? "공간을 채우는, 나만의 울림"
                        : karaoke
                          ? "당신의 목소리로 채워보세요"
                          : "좋아하는 음악에 나를 맡기는 시간"}
                    </span>
                  </div>
                  <div className="effect-controls">
                    <button
                      className={`effect-button ${karaoke ? "enabled" : ""}`}
                      onClick={toggleKaraoke}
                      aria-pressed={karaoke}
                    >
                      <div className="effect-icon">
                        <Mic2 size={25} />
                      </div>
                      <div className="effect-copy">
                        <strong>
                          노래방 <span>{karaoke ? "ON" : "OFF"}</span>
                        </strong>
                        <small>
                          {karaoke
                            ? "마이크 증폭 활성화"
                            : "나만의 무대를 켜보세요"}
                        </small>
                      </div>
                      <span className="toggle-track">
                        <i />
                      </span>
                    </button>
                    <button
                      className={`effect-button ${reverb ? "enabled reverb-enabled" : ""}`}
                      disabled={!karaoke}
                      onClick={() => setReverb(!reverb)}
                      aria-pressed={reverb}
                    >
                      <div className="effect-icon">
                        <Waves size={25} />
                      </div>
                      <div className="effect-copy">
                        <strong>
                          리버브 <span>{reverb ? "ON" : "OFF"}</span>
                        </strong>
                        <small>
                          {reverb
                            ? "리버브 효과 적용 중"
                            : karaoke
                              ? "목소리에 공간감을 더해요"
                              : "노래방 모드를 먼저 켜주세요"}
                        </small>
                      </div>
                      <span className="toggle-track">
                        <i />
                      </span>
                    </button>
                  </div>
                  <p className="mode-description" aria-live="polite">
                    {reverb ? (
                      <>
                        <Waves size={14} /> 노래방 모드 ON · 마이크 증폭 활성화
                        · 리버브 효과 적용 중
                      </>
                    ) : karaoke ? (
                      <>
                        <Mic2 size={14} /> 노래방 모드 ON · 마이크 증폭 활성화
                      </>
                    ) : (
                      <>
                        <Headphones size={14} /> 일반 음악 모드 · 노래방 버튼을
                        눌러 시작하세요
                      </>
                    )}
                  </p>
                </div>
              </section>
              <div className="player-bottom-note">
                <span>
                  <ShieldCheck size={15} /> 정차 중에만 노래방 모드를 사용할 수
                  있습니다.
                </span>
                <span>
                  UI 시연 모드 · 실제 오디오 및 마이크 처리는 제공하지 않습니다.
                </span>
              </div>
            </>
          )}

          {screen === "result" && session && (
            <section className="result-screen">
              <div className="result-check">
                <Check size={30} />
              </div>
              <div className="eyebrow">A MOMENT JUST FOR YOU</div>
              <h1>오늘의 나노 세션</h1>
              <p>당신의 목소리로 채운 시간, 멋진 무대였어요.</p>
              <div className="session-card">
                <AlbumArt
                  song={songs.find((s) => s.id === session.songId) || song}
                />
                <div>
                  <span className="eyebrow muted">MY NANO SESSION</span>
                  <h2>{song.title}</h2>
                  <p>{song.artist}</p>
                  <div className="session-tags">
                    <span>
                      <Clock3 size={13} />
                      {timeLabel(session.duration)}
                    </span>
                    <span>{session.karaoke ? "노래방 모드" : "음악 모드"}</span>
                    {session.reverb && <span>리버브 ON</span>}
                  </div>
                </div>
                <Waveform small />
              </div>
              <div className="result-actions">
                <button
                  className="primary-button"
                  onClick={saveSession}
                  disabled={sessionSaved}
                >
                  {sessionSaved ? (
                    <Check size={18} />
                  ) : (
                    <ArrowDownToLine size={18} />
                  )}{" "}
                  {sessionSaved ? "저장 완료" : "세션 저장하기"}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => startSong(song)}
                >
                  <RotateCcw size={17} />
                  다시 부르기
                </button>
              </div>
              <button
                className="text-button result-home"
                onClick={() => navigate("home")}
              >
                <House size={16} /> 홈으로 돌아가기
              </button>
              <small className="result-disclaimer">
                세션 정보만 이 브라우저에 저장됩니다. 음성은 녹음되지 않습니다.
              </small>
            </section>
          )}

          {screen === "history" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow muted">YOUR LITTLE MOMENTS</div>
                  <h1>나의 무대가 남긴 순간들.</h1>
                  <p>노래로 채운 시간을 다시 만나보세요.</p>
                </div>
                <span className="session-count">{saved.length} SESSIONS</span>
              </div>
              <section className="history-list">
                {saved.length ? (
                  saved.map((record) => {
                    const track = songs.find((s) => s.id === record.songId);
                    if (!track) return null;
                    return (
                      <article className="history-card" key={record.id}>
                        <AlbumArt song={track} />
                        <div>
                          <span className="eyebrow muted">
                            {new Date(record.date).toLocaleDateString("ko-KR")}
                          </span>
                          <h2>{track.title}</h2>
                          <p>
                            {track.artist} · {timeLabel(record.duration)} ·{" "}
                            {record.karaoke ? "노래방 모드" : "음악 모드"}
                            {record.reverb ? " · 리버브 ON" : ""}
                          </p>
                        </div>
                        <button
                          className="secondary-button"
                          onClick={() => startSong(track)}
                        >
                          <RotateCcw size={16} /> 다시 부르기
                        </button>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <Radio size={40} />
                    <h2>아직 기록된 무대가 없어요</h2>
                    <p>
                      노래를 부르고 세션을 저장해 보세요.
                      <br />
                      나만의 작은 순간들이 여기에 모입니다.
                    </p>
                    <button
                      className="primary-button"
                      onClick={() => navigate("songs")}
                    >
                      <Mic2 size={18} />첫 무대 시작하기
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {help && <HelpDialog onClose={() => setHelp(false)} />}
    </div>
  );
}

function HelpDialog({ onClose }) {
  const dialogRef = useRef();
  const previousFocus = useRef(document.activeElement);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => {
      dialog.close();
      previousFocus.current?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="help-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="dialog-content">
        <button
          className="icon-button dialog-close"
          aria-label="안내 닫기"
          onClick={onClose}
        >
          <X size={22} />
        </button>
        <Brand />
        <div className="eyebrow">YOUR CAR. YOUR STAGE.</div>
        <h2>나만의 공간에 오신 걸 환영해요.</h2>
        <p>
          나노는 자동차 안에서 즐기는
          <br />
          개인화된 노래방 경험을 제안합니다.
        </p>
        <ol>
          <li>
            <span>01</span>취향에 맞는 곡을 선택하세요.
          </li>
          <li>
            <span>02</span>노래방 모드를 켜고 무대를 시작하세요.
          </li>
          <li>
            <span>03</span>리버브로 나만의 공간감을 더해보세요.
          </li>
        </ol>
        <div className="dialog-notice">
          <ShieldCheck size={20} />
          <p>
            공모전 제출을 위한 인터페이스 데모입니다. 실제 음원 재생, 녹음,
            마이크 증폭, DSP 및 차량 API 연동은 포함하지 않습니다. 표시된 차량
            상태도 시연용입니다.
          </p>
        </div>
        <button className="primary-button" onClick={onClose}>
          좋아요, 시작할게요 <ArrowRight size={18} />
        </button>
      </div>
    </dialog>
  );
}
