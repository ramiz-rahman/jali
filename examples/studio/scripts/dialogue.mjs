/**
 * The three demo sessions: short fictional interviews. Every show, person and place here is made up.
 *
 * Each line is one segment, spoken by one macOS system voice (`say -v`). The voices are a placeholder for the lab:
 * replace them with properly licensed recordings before this example is published.
 *
 * `markers` name a segment by its index; the marker sits at that segment's start.
 */
export const SESSIONS = [
  {
    id: "night-ferry",
    show: "Harbour Hours",
    episode: 12,
    title: "The night ferry",
    recorded: "2026-10-04",
    music: { root: 57, tempo: 84, colour: "warm" },
    speakers: [
      { id: "host", name: "Maren Holt", role: "Host", voice: "Samantha", rate: 182 },
      { id: "guest", name: "Tomas Vell", role: "Ferry engineer", voice: "Daniel", rate: 176 },
    ],
    lines: [
      [
        "host",
        "Welcome back to Harbour Hours. I'm Maren Holt, and tonight we're down in the engine room of the last ferry out.",
      ],
      [
        "guest",
        "Thanks for having me. It's a bit loud down here, so I hope your microphones can cope.",
      ],
      ["host", "Tell me what a night crossing looks like from where you stand."],
      [
        "guest",
        "Quieter than people think. Once we clear the breakwater, it's mostly listening. You learn the sound of every pump.",
      ],
      ["host", "Listening? Not watching the dials?"],
      [
        "guest",
        "Both. But your ears notice a change before the needle moves. A bearing starts to sing about an hour before it complains.",
      ],
      ["host", "Has that ever saved a crossing?"],
      [
        "guest",
        "Once, in a winter storm. I heard a rattle in the fuel line, and we switched filters before the engine coughed. Nobody upstairs ever knew.",
      ],
      ["host", "That's the job, isn't it? Nobody noticing."],
      [
        "guest",
        "Exactly. A good night is a boring night. I bring a flask of tea and a crossword, and I hope to finish both.",
      ],
      ["host", "Last question. What's the best sound on the boat?"],
      ["guest", "The ramp coming down at the other side. That clank means everyone is home."],
      ["host", "Tomas Vell, thank you. That's Harbour Hours for this week."],
    ],
    markers: [
      [2, "The crossing"],
      [6, "Winter storm"],
      [10, "Best sound"],
    ],
  },
  {
    id: "seed-library",
    show: "Small Rooms",
    episode: 4,
    title: "A library of seeds",
    recorded: "2026-09-18",
    music: { root: 60, tempo: 96, colour: "bright" },
    speakers: [
      { id: "host", name: "Ines Qadir", role: "Host", voice: "Moira", rate: 178 },
      { id: "guest", name: "Arjun Pell", role: "Seed librarian", voice: "Rishi", rate: 174 },
    ],
    lines: [
      [
        "host",
        "This is Small Rooms, the show about places that fit in a cupboard. I'm Ines Qadir.",
      ],
      [
        "host",
        "Today I'm in a branch library, standing in front of an old card catalogue that holds seeds instead of cards.",
      ],
      [
        "guest",
        "That's right. Each drawer is a family. Beans on the top row, tomatoes in the middle, and flowers at the bottom, where children can reach.",
      ],
      ["host", "How does borrowing work?"],
      [
        "guest",
        "You take a packet, grow the plant, and at the end of the season you bring back some of its seeds. The library grows a little every year.",
      ],
      ["host", "And if the plant fails?"],
      [
        "guest",
        "Then you come back and tell us why. A failure is useful. It tells us which varieties like this valley and which ones sulk.",
      ],
      ["host", "What's the most borrowed drawer?"],
      [
        "guest",
        "A small yellow tomato. Somebody's grandmother brought it in, years ago, wrapped in a paper napkin. Now half the town grows it.",
      ],
      ["host", "So the catalogue keeps a history as well as seeds."],
      [
        "guest",
        "It does. Every packet has a name on it, and a date. Some of them have three or four names by now.",
      ],
      ["host", "Arjun Pell, thank you. Small Rooms will be back next week."],
    ],
    markers: [
      [3, "Borrowing"],
      [5, "When plants fail"],
      [7, "The yellow tomato"],
    ],
  },
  {
    id: "room-tone",
    show: "Field Notes",
    episode: 7,
    title: "Recording the quiet",
    recorded: "2026-08-30",
    music: { root: 55, tempo: 72, colour: "dark" },
    speakers: [
      { id: "host", name: "Lena Ashby", role: "Host", voice: "Karen", rate: 180 },
      { id: "guest", name: "Ruth Amari", role: "Sound recordist", voice: "Tessa", rate: 172 },
    ],
    lines: [
      [
        "host",
        "Hello, and welcome to Field Notes. I'm Lena Ashby. My guest records silence for a living, which sounds like a joke, but it isn't.",
      ],
      [
        "guest",
        "It isn't. Every film needs room tone, the sound of a place when nobody is talking. Without it, the edit sounds broken.",
      ],
      ["host", "Where do you go to find it?"],
      [
        "guest",
        "Anywhere people are about to be. An empty kitchen at dawn. A school hall in August. A forest before the wind picks up.",
      ],
      ["host", "What's the hardest place you've recorded?"],
      [
        "guest",
        "A desert at night. It was so still that my own heartbeat showed up on the meters. I had to breathe out slowly and keep very still.",
      ],
      ["host", "Did you use it?"],
      [
        "guest",
        "Yes, under a scene in a lighthouse. Nobody watching would ever guess where it came from.",
      ],
      ["host", "Do you have advice for people starting out?"],
      [
        "guest",
        "Turn off the fridge, and then remember to turn it back on. I have ruined more groceries than takes.",
      ],
      ["host", "Good advice for everyone. Thank you for coming on Field Notes."],
      ["guest", "Thank you. I'll leave you with the sound of a quiet hill."],
    ],
    markers: [
      [2, "Finding room tone"],
      [5, "The desert"],
      [8, "Advice"],
    ],
  },
];
