"""The excerpt's words, copied by hand from NASA's official transcripts (scanned pages checked by eye, not OCR):

 - AS11_TEC.pdf, "Apollo 11 Technical Air-to-Ground Voice Transcription (GOSS NET 1)", Tape 66/9 to 66/12,
   pages 314 to 317 (PDF pages 316 to 319), https://archive.org/download/Apollo11Audio/AS11_TEC.pdf
 - AS11_PAO.pdf, "Apollo 11 Mission Commentary", 7-20-69, GET 102:43:00, CDT 15:15, 307/1 (the PAO's own line)
   https://archive.org/download/Apollo11Audio/AS11_PAO.pdf

Each line: (GET as printed "DD HH MM SS", speaker code, text exactly as printed, track).
GET printed partly illegible on the scan is marked with '?' and is not used for timing (times come from alignment).
Lines that are only "..." in the transcript (unintelligible) are left out: they have no words to show or align.
"""

TEC = [
    ("04 06 42 41", "CC", "Eagle, looking great. You're GO."),
    ("04 06 42 58", "CC", "Roger. 1202. We copy it."),
    ("04 06 43 01", "LMP", "35 degrees. 35 degrees. 750. Coming down to 23."),
    ("04 06 43 07", "LMP", "700 feet, 21 down, 33 degrees."),
    ("04 06 43 11", "LMP", "600 feet, down at 19."),
    ("04 06 43 15", "LMP", "540 feet, down at - 30. Down at 15."),
    ("04 06 43 26", "LMP", "At 400 feet, down at 9."),
    ("04 06 43 29", "LMP", "... forward."),
    ("04 06 43 3?", "LMP", "350 feet, down at 4."),
    ("04 06 43 35", "LMP", "30, ... one-half down."),
    ("04 06 43 42", "LMP", "We're pegged on horizontal velocity."),
    ("04 06 43 46", "LMP", "300 feet, down 3 1/2, 47 forward."),
    ("04 06 43 ??", "LMP", "... up."),
    ("04 06 43 52", "LMP", "On 1 a minute, 1 1/2 down."),
    ("04 06 43 57", "CDR", "70."),
    ("04 06 44 04", "LMP", "Watch your shadow out there."),
    ("04 06 44 07", "LMP", "50, down at 2 1/2, 19 forward."),
    ("04 06 44 13", "LMP", "Altitude-velocity light."),
    ("04 06 44 16", "LMP", "3 1/2 down, 220 feet, 13 forward."),
    ("04 06 44 23", "LMP", "11 forward. Coming down nicely."),
    ("04 06 44 24", "LMP", "200 feet, 4 1/2 down."),
    ("04 06 44 26", "LMP", "5 1/2 down."),
    ("04 06 44 31", "LMP", "160, 6 - 6 1/2 down."),
    ("04 06 44 33", "LMP", "5 1/2 down, 9 forward. That's good."),
    ("04 06 44 40", "LMP", "120 feet."),
    ("04 06 44 4?", "LMP", "100 feet, 3 1/2 down, 9 forward. Five percent."),
    # 04 06 44 51 LMP "..." (left out: unintelligible in the transcript)
    ("04 06 44 54", "LMP", "Okay. 75 feet. There's looking good. Down a half, 6 forward."),
    ("04 06 45 02", "CC", "60 seconds."),
    ("04 06 45 04", "LMP", "Lights on. ..."),
    ("04 06 45 08", "LMP", "Down 2 1/2. Forward. Forward. Good."),
    ("04 06 45 17", "LMP", "40 feet, down 2 1/2. Kicking up some dust."),
    ("04 06 45 21", "LMP", "30 feet, 2 1/2 down. Faint shadow."),
    ("04 06 45 25", "LMP", "4 forward. 4 forward. Drifting to the right a little. Okay. Down a half."),
    ("04 06 45 31", "CC", "30 seconds."),
    ("04 06 45 32", "CDR", "Forward drift?"),
    ("04 06 45 33", "LMP", "Yes."),
    ("04 06 45 34", "LMP", "Okay."),
    ("04 06 45 40", "LMP", "CONTACT LIGHT."),
    ("04 06 45 43", "LMP", "Okay. ENGINE STOP."),
    ("04 06 45 45", "LMP", "ACA - out of DETENT."),
    ("04 06 45 46", "CDR", "Out of DETENT."),
    ("04 06 45 47", "LMP", "MODE CONTROL - both AUTO. DESCENT ENGINE COMMAND OVERRIDE - OFF. ENGINE ARM - OFF."),
    ("04 06 45 5?", "LMP", "413 is in."),
    ("04 06 45 57", "CC", "We copy you down, Eagle."),
    ("04 06 45 59", "CDR", "Houston, Tranquility Base here."),
    ("04 06 46 04", "CDR", "THE EAGLE HAS LANDED."),
    ("04 06 46 06", "CC", "Roger, Tranquility. We copy you on the ground. You got a bunch of guys about to turn blue. "
                          "We're breathing again. Thanks a lot."),
]

# The Public Affairs Officer's own words in the excerpt, from the Mission Commentary transcript (PAO 307/1).
PAO = [
    ("102:4?", "PAO", "Altitude 1600. 1400 feet. Still looking very good."),
]

# How each printed number or abbreviation was said: used only to place the printed words in time.
SPOKEN = {
    "1202": "twelve oh two", "35": "thirty five", "750": "seven fifty", "23": "twenty three", "700": "seven hundred",
    "21": "twenty one", "33": "thirty three", "600": "six hundred", "19": "nineteen", "540": "five forty",
    "30": "thirty", "15": "fifteen", "400": "four hundred", "9": "nine", "350": "three fifty", "4": "four",
    "300": "three hundred", "3": "three", "1/2": "and a half", "47": "forty seven", "1": "one", "70": "seventy",
    "50": "fifty", "2": "two", "220": "two twenty", "13": "thirteen", "11": "eleven", "200": "two hundred",
    "5": "five", "160": "one sixty", "6": "six", "120": "one twenty", "100": "one hundred", "75": "seventy five",
    "60": "sixty", "40": "forty", "413": "four thirteen", "ACA": "a c a", "1600": "sixteen hundred",
    "1400": "fourteen hundred", "one-half": "one half", "Altitude-velocity": "altitude velocity",
    "-": "", "...": "",
}


def spoken(token):
    core = token.strip(".,?!")
    if core in SPOKEN:
        return SPOKEN[core]
    if core.upper() in SPOKEN:
        return SPOKEN[core.upper()]
    return core.replace("-", " ")


SPEAKERS = [
    {"id": "cdr", "code": "CDR", "name": "Neil A. Armstrong", "role": "Commander, lunar module Eagle"},
    {"id": "lmp", "code": "LMP", "name": "Edwin E. \"Buzz\" Aldrin Jr.", "role": "Lunar module pilot, Eagle"},
    {"id": "cc", "code": "CC", "name": "Charles M. Duke Jr.", "role": "Capsule communicator (CAPCOM), Mission Control Houston"},
    {"id": "pao", "code": "PAO", "name": "Public Affairs Officer", "role": "Mission commentary, Houston (name not given in the transcript)"},
]
