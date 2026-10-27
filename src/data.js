export const songs = [
  {
    id: "night",
    title: "밤하늘 드라이브",
    artist: "서온",
    genre: "감성 발라드",
    mood: "밤에 어울리는",
    duration: 224,
    colors: ["#17142f", "#826890"],
    subtitle: "A LITTLE CLOSER TO THE STARS",
    lyrics: [
      "고요한 밤, 창밖을 스치는 바람",
      "익숙한 길 위에 나를 맡기면",
      "쏟아지는 별빛이 내게 말해",
      "오늘도 충분히 잘해 왔다고",
      "이 밤이 끝나기 전 너에게 닿기를",
      "우리의 노래는 계속될 거야",
    ],
  },
  {
    id: "city",
    title: "City Lights",
    artist: "LUNE",
    genre: "시티 팝",
    mood: "도시의 리듬",
    duration: 198,
    colors: ["#17232f", "#cb8d8c"],
    subtitle: "LOST IN THE CITY, FOUND IN THE MUSIC",
    lyrics: [
      "번지는 불빛 사이로",
      "우리는 같은 꿈을 꾸고",
      "잠들지 않는 도시의 밤",
      "너와 나의 리듬에 기대",
      "City lights, take me home",
      "이 순간을 기억해 줘",
    ],
  },
  {
    id: "season",
    title: "우리의 계절",
    artist: "하루",
    genre: "인디 팝",
    mood: "포근한 순간",
    duration: 242,
    colors: ["#223535", "#c0b18a"],
    subtitle: "EVERY SEASON, EVERY MOMENT",
    lyrics: [
      "천천히 물드는 오후의 햇살",
      "너와 걷던 길이 생각나",
      "계절이 지나도 변하지 않는",
      "작은 마음 하나 여기 남아서",
      "다시 만날 우리의 봄을 기다려",
      "그때처럼 웃어 줄래",
    ],
  },
  {
    id: "midnight",
    title: "Midnight Run",
    artist: "OFF THE ROAD",
    genre: "신스 팝",
    mood: "기분 전환",
    duration: 211,
    colors: ["#2a192e", "#e68d75"],
    subtitle: "THE NIGHT IS STILL YOUNG",
    lyrics: [
      "저 멀리 펼쳐진 밤을 따라",
      "어제의 걱정은 두고 와",
      "우리만 아는 멜로디 위로",
      "지금 이 순간 날아올라",
      "Midnight run, we feel alive",
      "끝나지 않을 우리의 밤",
    ],
  },
  {
    id: "dream",
    title: "Dream Route",
    artist: "NOVA",
    genre: "드림 팝",
    mood: "새로운 시작",
    duration: 236,
    colors: ["#183042", "#82b6c0"],
    subtitle: "FOLLOW YOUR OWN LITTLE UNIVERSE",
    lyrics: [
      "아직 이름 없는 길을 따라",
      "조금 느려도 괜찮아",
      "저마다 다른 별의 궤도로",
      "나의 우주를 만들어 가",
      "꿈이 데려가는 곳 어디든",
      "나답게 걸어갈 거야",
    ],
  },
];

export const timeLabel = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (!Array.isArray(value)) return fallback;

    const knownSong = (id) => songs.some((song) => song.id === id);
    if (key === "nano-favorites" || key === "nano-recent") {
      return [...new Set(value.filter(knownSong))];
    }
    if (key === "nano-sessions") {
      return value.filter(
        (record) =>
          record !== null &&
          typeof record === "object" &&
          Number.isFinite(record.id) &&
          knownSong(record.songId) &&
          Number.isFinite(record.duration) &&
          record.duration >= 0 &&
          typeof record.date === "string" &&
          Number.isFinite(Date.parse(record.date)) &&
          typeof record.karaoke === "boolean" &&
          typeof record.reverb === "boolean",
      );
    }
    return value;
  } catch {
    return fallback;
  }
}

export function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* The demo also works without browser storage. */
  }
}
