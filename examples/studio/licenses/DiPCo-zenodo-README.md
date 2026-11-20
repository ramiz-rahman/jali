# DipCo - Dinner Party Corpus

The ‘DipCo’ data corpus is a new data set that was publicly released by Amazon to help speech scientists address the difficult problem of separating speech signals in reverberant rooms with multiple speakers.

The corpus was created with the assistance of Amazon volunteers, who simulated the dinner-party scenario in the lab. We conducted multiple sessions, each involving four participants. At the beginning of each session, participants served themselves food from a buffet table. Most of the session took place at a dining table, and at fixed points in several sessions, we piped music into the room, to reproduce a noise source that will be common in real-world environments.

Each participant was outfitted with a headset microphone, which captured a clear, speaker-specific signal. Also dispersed around the room were five devices with seven microphones each, which fed audio signals directly to an administrator’s laptop. In each session, music playback started at a given time mark. The close-talk recordings were segmented and separately transcribed.

## Sessions

Each session contains the close talk recordings of 4 participants and the far-field recordings from the 5 devices. The following name conventions are used:

* sessions have a ```<session_id>``` label denoted by ```S01, S02, S03, ...``
* participants have a ```<speaker_id>``` label denoted by ```P01, P02, P03, P04, ...```
* devices have a ```<device_id>``` label  denoted by ```U01, U02, U03, U04, U05```
* array microphone have a ```<channel_id>``` label denoted by ```CH1, CH2, CH3, CH4, CH5, CH6, CH7```

We currently have the following sessions:

| **Session** | **Participants**               | **Hours**  **[hh:mm]** | **#Utts** | **Music start [hh:mm:ss]** |
| ----------- | ------------------------------ | ---------------------- | --------- | -------------------------- |
| S01         | P01, **P02**, **P03**, P04     | 00:47                  | 903       | 00:38:52                   |
| S02         | **P05**, **P06**, **P07**, P08 | 00:30                  | 448       | 00:19:30                   |
| S03         | **P09**, **P10**, **P11**, P12 | 00:46                  | 1128      | 00:33:45                   |
| S04         | **P13**, P14,   **P15**, P16   | 00:45                  | 1294      | 00:23:25                   |
| S05         | **P17**, **P18**, **P19**, P20 | 00:45                  | 1012      | 00:31:15                   |
| S06         | **P21**, P22, **P23**, **P24** | 00:20                  | 604       | 00:06:17                   |
| S07         | **P21**, P22, **P23**, **P24** | 00:26                  | 632       | 00:10:05                   |
| S08         | **P25**, P26, P27, P28         | 00:15                  | 352       | 00:01:02                   |
| S09         | P29, **P30**, P31, **P32**     | 00:22                  | 505       | 00:12:18                   |
| S10         | P29, **P30**, P31, **P32**     | 00:20                  | 432       | 00:07:10                   |
The sessions have been split into a development and evaluation set as follows:

| **Dataset** | **Sessions**            | **Hours**   [**hh:mm**] | **#Utts** |
| ----------- | ----------------------- | ----------------------- | --------- |
| Dev         | S02, S04, S05, S09, S10 | 02:43                   | 3691      |
| Eval        | S01, S03, S06, S07, S08 | 02:36                   | 3619      |

The DiPCo data set has the following directory structure:
```bash
DiPCo/
├── audio	
│    ├── dev		
│    └── eval	
└── transcriptions	
      ├── dev		
      └── eval	
```

## Audio

The audio data is converted into WAV format with a sample rate of 16kHz and 16-bit precision. The close-talk recordings were made by monaural microphone and contain a single channel. The far-field recordings of all 5 devices were microphone array recordings and contain 7 raw audio channels. 

The WAV file name convention is as follows:

* close talk recording of session ```<session_id>``` and participant ```<speaker_id>```
	* ```<session_id>_<speaker_id>.wav```, e.g. ```S01_P03.wav```
* farfield recording of microphone ```<channel_id>``` of session ```<session_id>``` and device ```<device_id>```  
  * ```<session_id>_<device_id>.<channel_id>.wav```, e.g. ```S02_U3.CH1.wav``` 


## Transcriptions

Per session, a JSON format transcription file ```<session_id>.json``` has been provided. The JSON files contains for each transcribed utterance the following metadata:

* Session ID ("session_id")

* Speaker ID ("speaker_id")

  * Gender ("gender_id")
  * Mother Tongue ("mother_tongue")
  * Nativeness ("nativeness")

* Transcription ("words")

* Start time of utterance ("start_time")
	* The close-talk microphone recording of the speaker (```close-talk```)
	* The farfield microphone array recordings of devices with ```<device_id>``` label
	
* End time ("end_time")

* Reference signal that was used transcribing the audio ("ref") 

The following is an example annotation of one utterance in a JSON file:

```json
    {
      "start_time": {
            "U01": "00:02:12.79",
            "U02": "00:02:12.79",
            "U03": "00:02:12.79",
            "U04": "00:02:12.79",
            "U05": "00:02:12.79",
            "close-talk": "00:02:12.79"
        },
      	"end_time": {
            "U01": "00:02:14.84",
            "U02": "00:02:14.84",
            "U03": "00:02:14.84",
            "U04": "00:02:14.84",
            "U05": "00:02:14.84",
            "close-talk": "00:02:14.84"
        },
        "gender": "male",
        "mother_tongue": "U.S. English",
        "nativeness": "native",
        "ref": "close-talk",
        "session_id": "S02",
        "speaker_id": "P05",
        "words": "[noise] how do you like the food"
    },
```

Transcriptions include the following tags: 

- [noise] noise made by the speaker (coughing, lip smacking, clearing throat, breathing, etc.) 
- [unintelligible] speech was not well understood by transcriber 
- [laugh] participant laughing

## License Summary

The DiPCo data set has been released under the CDLA-Permissive license. See the LICENSE file.

- [Amazon Science](https://www.amazon.science/)