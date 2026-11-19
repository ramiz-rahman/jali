# Credits and licences

Checked 2026-11-20. I read every quoted sentence at the source named next to it. Copies are saved in `licenses/`. In the saved archive.org metadata, the uploader's e-mail address is redacted.

---

## 1. Apollo 11: "The Eagle has landed" (`apollo11-landing`)

- **Title:** Apollo 11 lunar landing, final descent. Air-to-ground, Flight Director loop and mission commentary, 20 July 1969.
- **Source:** https://archive.org/details/Apollo11Audio, item "Apollo 11", creator "NASA". Files used:
  - `550-AAG.wav` (two-track tape: air-to-ground and Flight Director's loop)
  - `173-AAA.wav` (Mission Commentary 304-322)
  - `AS11_TEC.pdf` (Technical Air-to-Ground Voice Transcription)
  - `AS11_PAO.pdf` (Mission Commentary transcript)
- **Licence:** Public Domain Mark 1.0, https://creativecommons.org/publicdomain/mark/1.0/
  - Read at https://archive.org/metadata/Apollo11Audio (saved as `licenses/meta-Apollo11Audio.json`). The item has `"licenseurl": "http://creativecommons.org/publicdomain/mark/1.0/"` and no `rights` field. The description reads: "Digitized, cataloged and archived by the Houston Audio Control Room, at the NASA Johnson Space Center." The uploader is a nasa.gov address.
  - The licence is set at item level, so it covers every file used.
  - Public Domain Mark deed (saved as `licenses/public-domain-mark-1.0.txt`): "This work has been identified as being free of known restrictions under copyright law, including all related and neighboring rights. You can copy, modify, distribute and perform the work, even for commercial purposes, all without asking permission." Also: "The work may not be free of known copyright restrictions in all jurisdictions. Persons may have other rights in or related to the work, such as patent or trademark rights, and others may have rights in how the work is used, such as publicity or privacy rights."
- **NASA media usage guidelines:** https://www.nasa.gov/nasa-brand-center/images-and-media/ (text saved as `licenses/nasa-images-and-media.txt`). Exact sentences:
  - "NASA content – images, audio, video, and media files used in the rendition of 3-dimensional models, such as texture maps and polygon data in any format – generally are not subject to copyright in the United States. You may use this material for educational or informational purposes, including photo collections, textbooks, public exhibits, computer graphical simulations and Internet Web pages."
  - "NASA content used in a factual manner that does not imply endorsement may be used without needing explicit permission. NASA should be acknowledged as the source of the material."
  - "If the NASA material is to be used for commercial purposes, including advertisements, it must not explicitly or implicitly convey NASA's endorsement of commercial goods or services."
  - "The NASA Insignia, Logotype, identifiers, and imagery are not in the public domain. The use of the Insignia, Logotype and NASA identifiers is protected by law, …"
  - "If a NASA image, audio, video or media includes an identifiable person, using the media for commercial purposes may infringe that person's right of privacy or publicity, and permission should be obtained from the person."
  - The same page also has a section on "Super Intelligence (SI) Applications". It is about training AI models and attributing AI-generated information to NASA, and it does not concern this use. It is recorded here for completeness.
- **Conditions to honour:**
  - Credit NASA.
  - Do not imply NASA endorsement of the product or site.
  - Do not use the NASA insignia ("meatball"), logotype ("worm") or seal anywhere with this session.
  - Do not use the astronauts' names or voices to promote a product. The demo uses them factually, as transcript speaker labels.
- **Attribution to display:**
  > Apollo 11 audio and transcripts: NASA (Johnson Space Center, Houston Audio Control Room), via the Internet Archive (archive.org/details/Apollo11Audio). Public domain. Use does not imply endorsement by NASA.

---

## 2. "The Light caught by the Stone", Pablo Carlos Budassi (`light-caught-by-the-stone`)

- **Title:** "The Light caught by the Stone", Awe Plant. Music and lyrics by Pablo C. Budassi (MilKaya), recorded in 2016 at 9MFK Studios by Nueve Millas.
- **Source:** https://archive.org/details/thelightmasters, "Masters "The Light caught by the Stone" OPEN SOURCE MULTITRACK AUDIO", creator "Pablo Carlos Budassi", date 2017-06-01.
- **Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/
  - Read at https://archive.org/metadata/thelightmasters (saved as `licenses/meta-thelightmasters.json`): `"license": "https://creativecommons.org/licenses/by/4.0/"`.
  - The item's description says: "We leave here the audio master tracks of our theme "The Light caught by the Stone" in WAV format for DUB scientists who want to remix and make versions." It also says: "Masters of this track are open source for you to remix as you like: https://archive.org/details/thelightmasters".
  - The description itself does not name a licence. The CC BY 4.0 statement is the item's licence field.
  - Saved: `licenses/cc-by-4.0-legalcode.txt`. Section 3(a)(1): "If You Share the Licensed Material (including in modified form), You must: a. retain … identification of the creator(s) … a copyright notice; … a notice that refers to this Public License; … a notice that refers to the disclaimer of warranties; … a URI or hyperlink to the Licensed Material to the extent reasonably practicable; b. indicate if You modified the Licensed Material …; and c. indicate the Licensed Material is licensed under this Public License, and include the text of, or the URI or hyperlink to, this Public License."
- **Performers listed in the item:**

  | Part | Performer |
  |---|---|
  | Drums | Diego Gimenez |
  | Bass | Fran Vanini |
  | Guitar | Gon Arriagada |
  | Keyboards | Pablo Budassi |
  | Voices | Pablo Budassi, Tatiana Pino |
  | Trumpet and tenor sax | Nicolas Budassi |
  | Alto sax | Gerardo Soria |
  | Trombone | Roberto Rodríguez |

  Produced by Pablo Budassi.
- **Caveats:**
  - The licence is asserted by the archive.org uploader. Whether that account belongs to the rights holder could not be confirmed: the account name differs from the creator's, and that is unconfirmed.
  - The item also holds a 2024 mix by "Kresimir K". I used it only to compare levels and did not ship it.
- **Modifications:** I excerpted 3.700 to 150.141 s of the masters, summed the 28 masters into 8 groups and folded them to mono, applied one common gain and fades, and encoded to MP3.
- **Attribution to display:**
  > "The Light caught by the Stone" by Pablo Carlos Budassi / Awe Plant, performed by Nueve Millas. Licensed CC BY 4.0 (creativecommons.org/licenses/by/4.0). Source: archive.org/details/thelightmasters. Excerpt, stems grouped and re-encoded.

---

## 3. DiPCo: Dinner Party Corpus (`dinner-party`)

- **Title:** DiPCo, the Dinner Party Corpus (Amazon). Van Segbroeck, Zaid, Kutsenko, Huerta, Nguyen, Luo, Hoffmeister, Trmal, Omologo, Maas, Interspeech 2020. Session S02, close-talk microphones P05 to P08.
- **Sources:**
  - https://zenodo.org/record/8122551. The Zenodo API record (`licenses/zenodo-8122551.json`) gives `"license": {"id": "cdla-permissive-1.0"}`.
  - The Hugging Face mirror https://huggingface.co/datasets/huckiyang/DiPCo (`license: cdla-permissive-1.0`), from which the audio files were fetched.
- **Licence:** Community Data License Agreement – Permissive – Version 1.0 (CDLA-Permissive-1.0), https://cdla.dev/permissive-1-0/
- **The LICENSE shipped with the corpus:**
  - Read from the Zenodo archive itself (`Dipco/LICENSE.txt`, 10,461 bytes, saved as `licenses/DiPCo-zenodo-LICENSE.txt`). It is byte-identical to the mirror's `LICENSE.txt`, and its text matches the CDLA-Permissive 1.0 text at cdla.dev (saved as `licenses/cdla-permissive-1.0-cdla.dev.txt`).
  - The corpus README (`Dipco/README.md`, saved as `licenses/DiPCo-zenodo-README.md`) says: "The DiPCo data set has been released under the CDLA-Permissive license. See the LICENSE file."
- **Exact sentences that allow this use:**
  - 2.1: "Subject to the conditions set forth in Section 3 of this Agreement, Data Provider(s) hereby grant(s) to You a worldwide, non-exclusive, irrevocable (except as provided in Section 5) right to: (a) Use Data; and (b) Publish Data."
  - 1.7: "'Modify' means to delete, erase, correct or re-arrange Data, resulting in 'Modifications.'"
  - 1.5: "'Enhanced Data' means the subset of Data that You Publish and that is composed of (a) Your Additions and/or (b) Modifications to Data You have received under this Agreement."
  - 1.8: "'Publish' means to make all or a subset of Data (including Your Enhanced Data) available in any manner which enables its Use, including by providing a copy on physical media or remote access."
- **Conclusion:** publishing short edited excerpts in a public repository and on a website is allowed. The conditions follow.
- **Conditions (Section 3.1), exact:**
  - "(a) You may do so under a license of Your choice provided that You give anyone who Receives the Data from You the text of this Agreement, the name of this Agreement and/or a hyperlink or other method reasonably likely to provide a copy of the text of this Agreement;"
  - "(b) You must cause any Data files containing Enhanced Data to carry prominent notices that You have changed those files;"
  - "(c) If You Publish Data You Receive, You must preserve all credit or attribution to the Data Provider(s). Such retained credit or attribution includes any of the following to the extent they exist in Data as You have Received it: legal notices or metadata; identification of the Data Provider(s); or hyperlinks to Data to the extent it is practical to do so."
- **How to comply:**
  - Ship the licence text with the files (or link it): `licenses/DiPCo-zenodo-LICENSE.txt`.
  - Mark the files as changed. This is in `session.json` (`credits.modified`) and in the notice below. Ideally, also put a `NOTICE` next to `public/audio/dinner-party/`.
  - Keep the credit to Amazon / DiPCo and the link.
- **Privacy:** the speakers are real Amazon volunteers. 7.4 reads: "The Data Provider(s) reserve no right or expectation of privacy, data protection or confidentiality in any Data that they Publish under this Agreement." The excerpt was still chosen to be innocuous, and speakers are labelled only by the corpus ids.
- **Not verified:** the four WAVs came from the Hugging Face mirror. Their bytes were not checked against the Zenodo archive (unconfirmed); only the transcript JSON and the LICENSE were.
- **Modifications:** I excerpted S02 18.50 to 146.00 s, applied a 70 Hz high-pass, gated each mic by its wearer's utterance times (−14 dB outside them), resampled 16 to 32 kHz, levelled each track, applied fades, and encoded to MP3.
- **Notice to display:**
  > Conversation audio and transcript: DiPCo – Dinner Party Corpus, Amazon (zenodo.org/record/8122551), licensed under the Community Data License Agreement – Permissive 1.0 (cdla.dev/permissive-1-0). These files are modified from the original data: excerpted, filtered, gated, levelled and re-encoded.
